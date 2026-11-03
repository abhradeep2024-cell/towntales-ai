import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { ProductionSpecSchema } from '@film-studio/contracts';

const execFileAsync = promisify(execFile);
const env = (key: string) => process.env[key];
const rendererDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(rendererDir, '../../..');
const configuredPython = env('PYTHON_EXECUTABLE');
const pythonExecutable = configuredPython
  ? (isAbsolute(configuredPython) ? configuredPython : resolve(repositoryRoot, configuredPython))
  : 'python3';
const apiBase = (env('API_BASE_URL') ?? 'http://localhost:8080').replace(/\/$/, '');
const workerSecret = env('RENDERER_SHARED_SECRET');
const supabaseUrl = env('SUPABASE_URL')?.trim();
const serviceKey = (env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'))?.trim();
if (!workerSecret || !supabaseUrl || !serviceKey) throw new Error('Worker secrets are not configured.');

// Opaque sb_secret_* keys are API keys, not JWTs. Send them only in apikey,
// never as Authorization: Bearer; legacy service_role JWTs still work via the same path.
const supabaseApiKeyFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  headers.delete('Authorization');
  return fetch(input, { ...init, headers });
};
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: supabaseApiKeyFetch }
});
const bucket = env('SUPABASE_STORAGE_BUCKET') ?? 'towntales-assets';
const outputDir = env('RENDER_OUTPUT_DIR') ?? join(tmpdir(), 'film-studio-renders');
const concurrency = Math.max(1, Math.min(2, Number(env('REMOTION_CONCURRENCY') ?? 1)));
const browserExecutable = env('REMOTION_BROWSER_EXECUTABLE');

async function api(path: string, body: unknown = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${workerSecret}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`API ${path} failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  return response.json() as Promise<any>;
}

async function uploadVerifiedArtifact(objectKey: string, body: Buffer, contentType: string) {
  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectKey, body, {
    contentType, upsert: false, cacheControl: '3600'
  });
  if (uploadError) throw uploadError;
  const { data, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(objectKey, 300);
  if (signedError || !data?.signedUrl) throw signedError ?? new Error(`Could not sign production artifact ${objectKey}.`);
  const response = await fetch(data.signedUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Production artifact download failed for ${objectKey} (HTTP ${response.status}).`);
  const downloaded = Buffer.from(await response.arrayBuffer());
  if (!downloaded.equals(body)) throw new Error(`Production artifact verification failed for ${objectKey}.`);
  return { objectKey, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), verifiedDownload: true };
}

async function runJob(job: any, serveUrl: string) {
  const jobId = String(job.id);
  const parsed = ProductionSpecSchema.safeParse(job.production_specification);
  if (!parsed.success) throw new Error(`Invalid stored production specification: ${parsed.error.message}`);
  const production = parsed.data;
  const workDir = await mkdtemp(join(tmpdir(), 'film-studio-'));
  const outputPath = join(workDir, 'final.mp4');
  const silentPath = join(workDir, 'picture-only.mp4');
  const specPath = join(workDir, 'production.json');

  try {
    let renderer: 'lemo-opuscar' | 'remotion' = 'remotion';
    if (production.projectFiles) {
      renderer = 'lemo-opuscar';
      const projectDir = join(workDir, 'lemo-project');
      await mkdir(projectDir, { recursive: true });
      for (const [relativePath, contents] of Object.entries(production.projectFiles)) {
        const target = join(projectDir, relativePath);
        await mkdir(join(target, '..'), { recursive: true });
        await writeFile(target, contents, 'utf8');
      }
      const lemoEntry = join(repositoryRoot, 'vendor', 'lemo-opuscar', 'core', 'render', 'video.mjs');
      try { await stat(lemoEntry); } catch { throw new Error('The pinned Lemo-Opuscar submodule is missing. Check out the repository with submodules and install vendor/lemo-opuscar dependencies.'); }
      await api(`/internal/jobs/${jobId}/progress`, { status: 'rendering', progress: 8 });
      await execFileAsync('node', [lemoEntry, projectDir, '--fps', String(production.fps), '--workers', String(concurrency), '--out', silentPath, '--size', `${production.width}x${production.height}`], { timeout: 12 * 60 * 1000, maxBuffer: 2_000_000 });
      await api(`/internal/jobs/${jobId}/progress`, { status: 'rendering', progress: 82 });
    } else {
      const compositions = await getCompositions(serveUrl, { inputProps: { production }, ...(browserExecutable ? { browserExecutable } : {}) });
      const composition = compositions.find((item) => item.id === 'FilmStudio');
      if (!composition) throw new Error('FilmStudio composition was not registered.');
      const actual = {
        ...composition,
        width: production.width,
        height: production.height,
        fps: production.fps,
        durationInFrames: Math.round(production.durationSeconds * production.fps)
      };
      let lastSync = 0;
      let lastProgress = -1;
      let renderingActive = true;
      let progressWrites: Promise<void> = Promise.resolve();
      try {
        await renderMedia({
          composition: actual, serveUrl, codec: 'h264', outputLocation: silentPath, crf: 23, x264Preset: 'veryfast',
          inputProps: { production }, concurrency, ...(browserExecutable ? { browserExecutable } : {}),
          onProgress: ({ progress }) => {
            const pct = Math.max(2, Math.min(82, Math.round(progress * 80)));
            progressWrites = progressWrites.then(async () => {
              if (!renderingActive) return;
              const now = Date.now();
              if (pct === lastProgress || now - lastSync < 1000) return;
              const { data: current, error } = await supabase.from('film_studio_jobs').select('status').eq('id', jobId).single();
              if (error) throw error;
              if (current.status === 'cancelled') throw new Error('JOB_CANCELLED');
              await api(`/internal/jobs/${jobId}/progress`, { status: 'rendering', progress: pct });
              lastProgress = pct;
              lastSync = Date.now();
            });
            return progressWrites;
          }
        });
      } catch (renderError) {
        renderingActive = false;
        await progressWrites.catch(() => undefined);
        throw renderError;
      }
      renderingActive = false;
      await progressWrites;
    }

    await writeFile(specPath, JSON.stringify(production), 'utf8');
    const audioScript = join(rendererDir, '..', 'scripts', 'audio_pipeline.py');
    await execFileAsync(pythonExecutable, [
      audioScript, '--spec', specPath, '--video', silentPath, '--output', outputPath, '--workdir', workDir,
      ...(production.audio.burnSubtitles ? ['--burn-subtitles'] : []),
      ...(production.audio.voiceEnabled && production.scenes.some((scene) => scene.narration.trim().length > 0) ? ['--require-word-alignment'] : [])
    ], { timeout: 8 * 60 * 1000, maxBuffer: 2_000_000 });

    await api(`/internal/jobs/${jobId}/progress`, { status: 'rendering', progress: 88 });

    const probe = await execFileAsync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_read_frames', '-of', 'json', outputPath]);
    const metadata = JSON.parse(probe.stdout);
    const bytes = (await stat(outputPath)).size;
    if (!bytes || bytes < 1000) throw new Error('Rendered MP4 is unexpectedly small.');
    if (bytes > 50 * 1024 * 1024) throw new Error('Rendered MP4 exceeds the existing Supabase bucket limit of 50 MB. Reduce duration, resolution, or visual complexity.');
    await execFileAsync('ffmpeg', ['-v', 'error', '-i', outputPath, '-f', 'null', '-']);
    const duration = Number(metadata.format?.duration ?? 0);
    if (Math.abs(duration - production.durationSeconds) > 1) throw new Error(`Duration mismatch: expected ${production.durationSeconds}s, got ${duration}s.`);
    const streams = metadata.streams ?? [];
    const video = streams.find((stream: any) => stream.codec_type === 'video');
    if (!video || video.width !== production.width || video.height !== production.height) throw new Error('Video dimensions do not match the production specification.');
    if (video.codec_name !== 'h264') throw new Error(`Expected H.264 video, received ${video.codec_name ?? 'unknown'}.`);
    const [frameNumerator, frameDenominator] = String(video.avg_frame_rate ?? '0/1').split('/').map(Number);
    const [nominalNumerator, nominalDenominator] = String(video.r_frame_rate ?? '0/1').split('/').map(Number);
    const actualFps = frameDenominator ? frameNumerator / frameDenominator : 0;
    const nominalFps = nominalDenominator ? nominalNumerator / nominalDenominator : 0;
    if (Math.abs(actualFps - production.fps) > 0.05 || Math.abs(nominalFps - production.fps) > 0.05) {
      throw new Error('Average or nominal frame rate does not match the production specification.');
    }
    const expectedFrames = Math.round(production.durationSeconds * production.fps);
    const actualFrames = Number(video.nb_read_frames ?? video.nb_frames ?? 0);
    if (!actualFrames || actualFrames !== expectedFrames) throw new Error(`Expected exactly ${expectedFrames} decoded frames, received ${actualFrames || 'unknown'}.`);
    if (production.styleId === 'roblox-cinematic-horror' &&
        (production.width !== 1080 || production.height !== 1920 || production.fps !== 30 || production.durationSeconds !== 60)) {
      throw new Error('TownTales Episode 01 must render at 1080x1920, 30 FPS and 60 seconds.');
    }
    const audioStream = streams.find((stream: any) => stream.codec_type === 'audio');
    const audioPresent = Boolean(audioStream);
    const audioRequested = Boolean(production.audio?.musicEnabled || (production.audio?.voiceEnabled && production.scenes.some((scene) => scene.narration.trim().length > 0)));
    if (audioRequested && !audioPresent) throw new Error('Audio was requested but no audio track was found in the final MP4.');
    if (audioRequested && audioStream.codec_name !== 'aac') throw new Error(`Expected AAC audio, received ${audioStream.codec_name ?? 'unknown'}.`);

    const { data: latest, error: latestError } = await supabase.from('film_studio_jobs').select('status').eq('id', jobId).single();
    if (latestError) throw latestError;
    if (latest.status === 'cancelled') throw new Error('JOB_CANCELLED');
    await api(`/internal/jobs/${jobId}/progress`, { status: 'uploading', progress: 95 });
    const objectKey = `${jobId}/${randomUUID()}.mp4`;
    const file = await readFile(outputPath);
    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectKey, file, { contentType: 'video/mp4', upsert: false, cacheControl: '3600' });
    if (uploadError) throw uploadError;

    // Verify that the private object can be retrieved through a short-lived signed URL.
    const { data: signedObject, error: signedUrlError } = await supabase.storage.from(bucket).createSignedUrl(objectKey, 300);
    if (signedUrlError || !signedObject?.signedUrl) throw signedUrlError ?? new Error('Could not create a signed URL for the uploaded MP4.');
    const signedDownload = await fetch(signedObject.signedUrl, { signal: AbortSignal.timeout(90000) });
    if (!signedDownload.ok) throw new Error(`Signed MP4 download failed (HTTP ${signedDownload.status}).`);
    const downloadedFile = Buffer.from(await signedDownload.arrayBuffer());
    if (downloadedFile.length !== bytes || !downloadedFile.equals(file)) {
      throw new Error('Signed MP4 download did not match the uploaded file byte-for-byte.');
    }
    const downloadedPath = join(workDir, 'signed-download-verification.mp4');
    await writeFile(downloadedPath, downloadedFile);
    await execFileAsync('ffmpeg', ['-v', 'error', '-i', downloadedPath, '-f', 'null', '-']);

    const narrationRequested = Boolean(production.audio?.voiceEnabled && production.scenes.some((scene) => scene.narration.trim().length > 0));
    const qcReport: Record<string, any> = {
      passed: true,
      releaseReady: false,
      releaseStatus: 'pending-creative-review',
      renderer,
      checks: {
        exists: true, nonzeroSize: true, ffprobe: true, ffmpegDecode: true,
        durationWithinTolerance: true, dimensionsMatch: true, frameRateMatches: true,
        h264Video: true, aacAudio: audioRequested ? true : null,
        audioPresent: audioRequested ? audioPresent : true,
        wordAlignment: narrationRequested ? true : null,
        wordSynchronizedCaptions: narrationRequested ? true : null,
        privateSignedUrl: true, signedDownload: true, downloadedFileMatchesUpload: true
      },
      durationSeconds: duration, width: video.width, height: video.height, fps: actualFps,
      decodedFrames: actualFrames || expectedFrames, bytes,
      sha256: createHash('sha256').update(file).digest('hex'),
      audioPresent, sizeLimitBytes: 50 * 1024 * 1024,
      audioMode: {
        musicEnabled: production.audio.musicEnabled, voiceEnabled: production.audio.voiceEnabled,
        burnSubtitles: narrationRequested || production.audio.burnSubtitles, musicStyle: production.audio.musicStyle, effectsEnabled: production.styleId === 'roblox-cinematic-horror',
        captionTiming: narrationRequested ? 'edge-tts-word-boundary' : null
      },
      validatedAt: new Date().toISOString()
    };

    const artifacts: Record<string, any> = {};
    const manifest = {
      schemaVersion: 1,
      episode: production.title,
      generatedAt: new Date().toISOString(),
      productionFormat: { width: production.width, height: production.height, fps: production.fps, durationSeconds: production.durationSeconds, aspectRatio: production.aspectRatio },
      approvedNarrationScript: production.scenes.map((scene) => scene.narration.trim()).filter(Boolean),
      sceneManifest: production.scenes.map((scene, index) => ({
        order: index + 1, id: scene.id, durationSeconds: scene.durationSeconds,
        title: scene.title, visualDirection: scene.visualDirection, narration: scene.narration,
        background: scene.background
      })),
      characters: production.styleId === 'roblox-cinematic-horror' ? [
        { id: 'CHAR_ALEX_001', name: 'Alex', wardrobe: ['black messy hair', 'blue hoodie', 'black trousers', 'white sneakers'], assetStatus: 'procedural R6-inspired model' },
        { id: 'CHAR_SHADOW_ALEX_001', name: 'Shadow Alex', appearance: 'matte near-black silhouette with subtle pale eyes', controller: 'independent animation controller' }
      ] : [],
      environmentAssets: production.styleId === 'roblox-cinematic-horror' ? [
        'ENV_TOWN_STREET_001', 'ENV_ALEX_HOUSE_001', 'ENV_BEDROOM_001',
        'PROP_CLOCK_001', 'PROP_WARNING_SIGN_001', 'LIGHT_STREET_001', 'LIGHT_BEDROOM_001'
      ] : [],
      styleInvariants: production.styleInvariants,
      sourceProductionSpec: production
    };
    const manifestKey = objectKey.replace(/\.mp4$/, '.production-manifest.json');
    artifacts.productionManifest = await uploadVerifiedArtifact(manifestKey, Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json');

    if (narrationRequested) {
      const alignmentPath = join(workDir, 'word-alignments.json');
      const alignmentBytes = await readFile(alignmentPath);
      const alignment = JSON.parse(alignmentBytes.toString('utf8'));
      if (!Array.isArray(alignment.words) || alignment.words.length === 0) throw new Error('Word-alignment sidecar is empty.');
      const alignmentKey = objectKey.replace(/\.mp4$/, '.word-alignments.json');
      artifacts.wordAlignments = await uploadVerifiedArtifact(alignmentKey, alignmentBytes, 'application/json');
    }

    const creativeReview = {
      status: 'pending-human-review',
      releaseApproved: false,
      requiredReview: [
        'Watch all nine scenes in sequence and confirm story comprehension.',
        'Inspect Alex identity, wardrobe and proportions across every scene.',
        'Inspect independent shadow timing, three-wave gesture and head turn.',
        'Confirm the bedroom double casts no visible shadow.',
        'Confirm Alex has no shadow in daylight while residents do.',
        'Confirm the original shadow is visible behind the same bedroom window and waves before the cut.',
        'Listen to narration, music and effects on phone speakers and headphones.',
        'Inspect caption safe areas, readability and word-level synchronization.'
      ],
      automatedReviewLimit: 'Automated technical checks cannot certify subjective creative quality or replace final visual approval.'
    };
    const creativeKey = objectKey.replace(/\.mp4$/, '.creative-qa.json');
    artifacts.creativeQa = await uploadVerifiedArtifact(creativeKey, Buffer.from(JSON.stringify(creativeReview, null, 2)), 'application/json');

    qcReport.artifacts = artifacts;
    const technicalKey = objectKey.replace(/\.mp4$/, '.technical-qa.json');
    artifacts.technicalQa = await uploadVerifiedArtifact(technicalKey, Buffer.from(JSON.stringify(qcReport, null, 2)), 'application/json');
    await api(`/internal/jobs/${jobId}/complete`, { outputKey: objectKey, outputBytes: bytes, qcReport });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const entry = join(rendererDir, 'index.tsx');
  const serveUrl = await bundle({ entryPoint: entry, onProgress: (progress) => console.log(`Bundle ${Math.round(progress * 100)}%`) });
  const processOnce = env('RENDER_ONCE') === 'true';
  console.log(`Film Studio renderer ready. concurrency=${concurrency}`);

  while (true) {
    try {
      const claimed = await api('/internal/jobs/claim');
      if (!claimed.job) { if (processOnce) return; await new Promise((resolve) => setTimeout(resolve, 5000)); continue; }
      try {
        await runJob(claimed.job, serveUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown rendering error';
        console.error(`Job ${claimed.job.id} failed: ${message}`);
        if (message !== 'JOB_CANCELLED') {
          try {
            await api(`/internal/jobs/${claimed.job.id}/progress`, { status: 'failed', progress: 0, error: message });
          } catch (updateError) {
            console.error('Could not persist failure status', updateError);
          }
        }
        if (processOnce) throw error;
      }
      if (processOnce) return;
    } catch (error) {
      console.error('Worker polling failed:', error);
      if (processOnce) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
