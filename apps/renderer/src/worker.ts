import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
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

  try {
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
    await renderMedia({
      composition: actual, serveUrl, codec: 'h264', outputLocation: outputPath, crf: 28, x264Preset: 'veryfast',
      inputProps: { production }, concurrency, ...(browserExecutable ? { browserExecutable } : {}),
      onProgress: async ({ progress }) => {
        const { data: current, error } = await supabase.from('film_studio_jobs').select('status').eq('id', jobId).single();
        if (error) throw error;
        if (current.status === 'cancelled') throw new Error('JOB_CANCELLED');
        await api(`/internal/jobs/${jobId}/progress`, { status: 'rendering', progress: Math.max(2, Math.min(92, Math.round(progress * 90))) });
      }
    });

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
    const audioRequested = Boolean(production.audio?.musicAssetId || production.audio?.voiceAssetId);
    if (audioRequested && !audioPresent) throw new Error('Audio was requested but no audio track was rendered. Audio asset mixing is not enabled yet.');

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
      checks: { exists: true, nonzeroSize: true, ffprobe: true, ffmpegDecode: true, durationWithinTolerance: true, dimensionsMatch: true },
      durationSeconds: duration, width: video.width, height: video.height, bytes,
      audioPresent, sizeLimitBytes: 50 * 1024 * 1024,
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
