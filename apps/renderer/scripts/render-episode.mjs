import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { episode01Production } from '../src/compositions/episode01.ts';

const [compositionId, alignmentPath, outputPath] = process.argv.slice(2);
if (!compositionId || !alignmentPath || !outputPath) {
  throw new Error('Usage: render-episode.mjs <composition-id> <word-alignments.json> <output.mp4>');
}
const alignment = JSON.parse(await readFile(resolve(alignmentPath), 'utf8'));
const wordAlignments = Array.isArray(alignment.words) ? alignment.words : [];
if (!wordAlignments.length) throw new Error('Episode rendering requires prepared word-level narration alignment.');

const inputProps = { production: episode01Production, wordAlignments };
const entryPoint = join(process.cwd(), 'src/index.tsx');
const serveUrl = await bundle({
  entryPoint,
  onProgress: (progress) => process.stdout.write(`Bundling ${Math.round(progress * 100)}%\r`)
});
process.stdout.write('\n');
const compositions = await getCompositions(serveUrl, { inputProps });
const composition = compositions.find((item) => item.id === compositionId);
if (!composition) throw new Error(`Remotion composition not found: ${compositionId}`);

await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: resolve(outputPath),
  inputProps,
  crf: 23,
  x264Preset: 'veryfast',
  pixelFormat: 'yuv420p',
  concurrency: 2,
  onProgress: ({ progress }) => process.stdout.write(`Rendering ${Math.round(progress * 100)}%\r`)
});
process.stdout.write(`\nRendered ${compositionId} to ${resolve(outputPath)}\n`);
