import { z } from 'zod';

export const AspectRatioSchema = z.enum(['16:9', '9:16', '1:1']);
export const JobStatusSchema = z.enum(['queued', 'rendering', 'uploading', 'completed', 'failed', 'cancelled']);

export const SceneSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  durationSeconds: z.number().positive().max(90),
  narration: z.string().max(5000).default(''),
  visualDirection: z.string().min(1).max(4000),
  onScreenText: z.array(z.string().max(300)).max(20).default([]),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#101522')
});

export const ProductionSpecSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().min(1).max(160),
  idea: z.string().min(1).max(8000),
  styleId: z.string().min(1).max(120),
  styleInvariants: z.array(z.string().max(500)).max(30).default([]),
  durationSeconds: z.number().int().min(1).max(90),
  aspectRatio: AspectRatioSchema,
  fps: z.union([z.literal(24), z.literal(25), z.literal(30)]).default(30),
  width: z.number().int().min(320).max(1920).default(1280),
  height: z.number().int().min(320).max(1920).default(720),
  scenes: z.array(SceneSchema).min(1).max(30),
  subtitles: z.array(z.object({start: z.number().nonnegative(), end: z.number().positive(), text: z.string().min(1).max(500)})).max(300).default([]),
  audio: z.object({musicAssetId: z.string().optional(), voiceAssetId: z.string().optional(), musicVolume: z.number().min(0).max(1).default(0.18)}).default({ musicVolume: 0.18 })
}).superRefine((spec, ctx) => {
  const sceneDuration = spec.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (Math.abs(sceneDuration - spec.durationSeconds) > 1) ctx.addIssue({code: 'custom', path: ['scenes'], message: 'Scene durations must add up to the requested runtime (±1 second).'});
  if (spec.aspectRatio === '9:16' && spec.width >= spec.height) ctx.addIssue({code: 'custom', path: ['width'], message: '9:16 output requires portrait dimensions.'});
  if (spec.aspectRatio === '16:9' && spec.width <= spec.height) ctx.addIssue({code: 'custom', path: ['width'], message: '16:9 output requires landscape dimensions.'});
  if (spec.aspectRatio === '1:1' && spec.width !== spec.height) ctx.addIssue({code: 'custom', path: ['width'], message: '1:1 output requires equal dimensions.'});
});

export const CreateJobSchema = z.object({production: ProductionSpecSchema});
export type ProductionSpec = z.infer<typeof ProductionSpecSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
