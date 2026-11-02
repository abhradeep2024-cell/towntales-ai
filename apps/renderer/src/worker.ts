import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ProductionSpecSchema } from '@film-studio/contracts';

const execFileAsync = promisify(execFile);
const env = (key: string) => process.env[key];
const apiBase = (env('API_BASE_URL') ?? 'http://localhost:8080').replace(/\/$/, '');
const workerSecret = env('RENDERER_SHARED_SECRET');
const supabaseUrl = env('SUPABASE_URL');
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
if (!workerSecret || !supabaseUrl || !serviceKey) throw new Error('Worker secrets are not configured.');

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
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
      const lemoEntry = join(process.cwd(), 'vendor', 'lemo-opuscar', 'core', 'render', 'video.mjs');
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
      await renderMedia({
        composition: actual, serveUrl, codec: 'h264', outputLocation: silentPath, crf: 28, x264Preset: 'veryfast',
        inputProps: { production }, concurrency, ...(browserExecutable ? { browserExecutable } : {}),
        onProgress: async ({ progress }) => {
          const pct = Math.max(2, Math.min(82, Math.round(progress * 80)));
          const now = Date.now();
          if (pct === lastProgress && now - lastSync < 2500) return;
          const { data: current, error } = await supabase.from('film_studio_jobs').select('status').eq('id', jobId).single();
          if (error) throw error;
          if (current.status === 'cancelled') throw new Error('JOB_CANCELLED');
          if (pct !== lastProgress) await api(`/internal/jobs/${jobId}/progress`, { status: 'rendering', progress: pct });
          lastProgress = pct;
          lastSync = now;
        }
      });
    }

    await writeFile(specPath, JSON.stringify(production), 'utf8');
    const audioScript = join(process.cwd(), 'apps', 'renderer', 'scripts', 'audio_pipeline.py');
    await execFileAsync(env('PYTHON_EXECUTABLE') ?? 'python3', [
      audioScript, '--spec', specPath, '--video', silentPath, '--output', outputPath, '--workdir', workDir,
      ...(production.projectFiles ? ['--burn-subtitles'] : [])
    ], { timeout: 4 * 60 * 1000, maxBuffer: 2_000_000 });

    await api(`/internal/jobs/${jobId}/progress`, { status: 'rendering', progress: 88 });

    const probe = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,width,height,r_frame_rate', '-of', 'json', outputPath]);
    const metadata = JSON.parse(probe.stdout);
    const bytes = (await stat(outputPath)).size;
    if (!bytes || bytes < 1000) throw new Error('Rendered MP4 is unexpectedly small.');
    if (bytes > 50 * 1024 * 1024) throw new Error('Rendered MP4 exceeds the existing Supabase bucket limit of 50 MB. Reduce duration, resolution, or visual complexity.');
    await execFileAsync('ffmpeg', ['-v', 'error', '-i', outputPath, '-f', 'null', '-']);
    const duration = Number(metadata.format?.duration ?? 0);
    if (Math.abs(duration - production.durationSeconds) > 1) throw new Error(`Duration mismatch: expected ${production.durationSeconds}s, got ${duration}s.`);
    const video = (metadata.streams ?? []).find((stream: any) => stream.codec_type === 'video');
    if (!video || video.width !== production.width || video.height !== production.height) throw new Error('Video dimensions do not match the production specification.');
    const [frameNumerator, frameDenominator] = String(video.r_frame_rate ?? '0/1').split('/').map(Number);
    const actualFps = frameDenominator ? frameNumerator / frameDenominator : 0;
    if (Math.abs(actualFps - production.fps) > 0.05) throw new Error('Frame rate does not match the production specification.');
    const audioPresent = (metadata.streams ?? []).some((stream: any) => stream.codec_type === 'audio');
    const audioRequested = Boolean(production.audio?.musicEnabled || (production.audio?.voiceEnabled && production.scenes.some((scene) => scene.narration.trim().length > 0)) || production.audio?.musicAssetId || production.audio?.voiceAssetId);
    if (audioRequested && !audioPresent) throw new Error('Audio was requested but no audio track was found in the final MP4.');

    const { data: latest, error: latestError } = await supabase.from('film_studio_jobs').select('status').eq('id', jobId).single();
    if (latestError) throw latestError;
    if (latest.status === 'cancelled') throw new Error('JOB_CANCELLED');
    await api(`/internal/jobs/${jobId}/progress`, { status: 'uploading', progress: 95 });
    const objectKey = `${jobId}/${randomUUID()}.mp4`;
    const file = await readFile(outputPath);
    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectKey, file, { contentType: 'video/mp4', upsert: false, cacheControl: '3600' });
    if (uploadError) throw uploadError;
    const qcReport = {
      passed: true,
      renderer,
      checks: { exists: true, nonzeroSize: true, ffprobe: true, ffmpegDecode: true, durationWithinTolerance: true, dimensionsMatch: true, frameRateMatches: true, audioPresent: audioRequested ? audioPresent : true },
      durationSeconds: duration, width: video.width, height: video.height, fps: actualFps, bytes,
      audioPresent, sizeLimitBytes: 50 * 1024 * 1024,
      audioMode: { musicEnabled: production.audio.musicEnabled, voiceEnabled: production.audio.voiceEnabled, musicStyle: production.audio.musicStyle },
      validatedAt: new Date().toISOString()
    };
    await api(`/internal/jobs/${jobId}/complete`, { outputKey: objectKey, outputBytes: bytes, qcReport });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const entry = new URL('./index.tsx', import.meta.url).pathname;
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
