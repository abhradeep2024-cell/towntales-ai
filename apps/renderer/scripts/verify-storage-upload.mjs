import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const url = process.env.SUPABASE_URL?.trim();
const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'towntales-assets';
const inputPath = process.argv[2];
if (!url || !key || !inputPath) throw new Error('SUPABASE_URL, SUPABASE_SECRET_KEY and the MP4 path are required.');

const apiKeyFetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  headers.delete('Authorization');
  return fetch(input, { ...init, headers });
};
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: apiKeyFetch }
});

const source = await readFile(inputPath);
const objectKey = `ci-verify/${randomUUID()}.mp4`;
const downloadedPath = join(tmpdir(), `towntales-storage-verify-${randomUUID()}.mp4`);
let uploaded = false;
try {
  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectKey, source, {
    contentType: 'video/mp4', upsert: false, cacheControl: '60'
  });
  if (uploadError) throw uploadError;
  uploaded = true;

  const { data, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(objectKey, 300);
  if (signedError || !data?.signedUrl) throw signedError ?? new Error('Supabase did not return a signed URL.');
  const response = await fetch(data.signedUrl, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Signed MP4 download failed with HTTP ${response.status}.`);
  const downloaded = Buffer.from(await response.arrayBuffer());
  if (!downloaded.equals(source)) throw new Error('Signed download does not match the uploaded MP4 byte-for-byte.');

  await writeFile(downloadedPath, downloaded);
  await execFileAsync('ffmpeg', ['-v', 'error', '-i', downloadedPath, '-f', 'null', '-']);
  console.log(`Supabase private upload, signed download and decode passed (${downloaded.length} bytes).`);
} finally {
  await rm(downloadedPath, { force: true });
  if (uploaded) {
    const { error: removeError } = await supabase.storage.from(bucket).remove([objectKey]);
    if (removeError) throw removeError;
  }
}
