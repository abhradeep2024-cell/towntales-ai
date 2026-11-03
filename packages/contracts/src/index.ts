import { z } from 'zod';

export const AspectRatioSchema = z.enum(['16:9', '9:16', '1:1']);
export const JobStatusSchema = z.enum(['queued', 'rendering', 'uploading', 'completed', 'failed', 'cancelled']);

export const ProjectFilesSchema = z.record(z.string(), z.string()).superRefine((files, ctx) => {
  const entries = Object.entries(files);
  if (!files['index.html']) ctx.addIssue({code:'custom',path:['index.html'],message:'A Lemo film project must contain index.html.'});
  if (entries.length > 40) ctx.addIssue({code:'custom',path:[],message:'A film project may contain at most 40 text assets.'});
  let totalBytes = 0;
  for (const [name, content] of entries) {
    if (!/^[a-zA-Z0-9._/-]{1,180}$/.test(name) || name.startsWith('/') || name.split('/').some((part) => !part || part === '.' || part === '..')) {
      ctx.addIssue({code:'custom',path:[name],message:'Unsafe project path.'});
    }
    if (!/\.(html|js|mjs|css|json|svg|txt|srt|xml)$/i.test(name)) {
      ctx.addIssue({code:'custom',path:[name],message:'Project files must be text-based HTML, JS, CSS, JSON, SVG, TXT, SRT or XML.'});
    }
    totalBytes += new TextEncoder().encode(content).length;
  }
  if (totalBytes > 1_800_000) ctx.addIssue({code:'custom',path:[],message:'Project text assets must total 1.8 MB or less. Put small media in data URIs and keep assets optimized.'});
  const allSource = entries.map(([, source]) => source).join('\n');
  for (const contract of ['window.DUR','window.render','window.READY']) {
    if (!allSource.includes(contract)) ctx.addIssue({code:'custom',path:['index.html'],message:'The project bundle must implement the Lemo page contract: ' + contract + '.'});
  }
  const remoteResourcePatterns = [
    /<(script|link|img|audio|video|source)\b[^>]*(src|href)\s*=\s*["']\s*https?:\/\//i,
    /@import\s+(?:url\()?\s*["']?https?:\/\//i,
    /\b(?:import|export)\s+[^;]*?\bfrom\s*["']https?:\/\//is,
    /\bimport\s*\(\s*["']https?:\/\//i,
    /\bfetch\s*\(\s*["']https?:\/\//i
  ];
  if (remoteResourcePatterns.some((pattern) => pattern.test(allSource))) {
    ctx.addIssue({code:'custom',path:[],message:'Lemo project files must load scripts, styles and media locally; remote resource URLs are not allowed.'});
  }
});


export const Vector3Schema = z.tuple([z.number(), z.number(), z.number()]);
export const CharacterAppearanceSchema = z.object({
  bodyColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2563a6'),
  skinColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#e8b58e'),
  hairColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#171717'),
  pantsColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#171a22'),
  shoeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#f2f2f2'),
  eyeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#171717'),
  eyeEmissiveColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#000000'),
  eyeEmissiveIntensity: z.number().min(0).max(5).default(0),
  mouthColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#914d43'),
  castShadow: z.boolean().default(true),
  receiveShadow: z.boolean().default(true),
  scale: z.number().min(0.25).max(3).default(1)
}).default({});
export const CharacterAssetSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  rig: z.enum(['block-humanoid']).default('block-humanoid'),
  appearance: CharacterAppearanceSchema
});
export const ActorActionSchema = z.object({
  type: z.enum(['idle','walk','run','wave','point','turn','jump','recoil','gesture','expression','move','disappear','appear']),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive().max(90),
  intensity: z.number().min(0).max(2).default(1),
  arm: z.enum(['left','right','both']).default('right'),
  targetPosition: Vector3Schema.optional(),
  targetRotationY: z.number().optional(),
  repeat: z.number().int().min(1).max(20).default(1),
  emotion: z.enum(['neutral','fear','shock','smile','angry','sad']).optional(),
  note: z.string().max(500).optional()
});
export const SceneActorSchema = z.object({
  characterId: z.string().min(1).max(80),
  position: Vector3Schema.default([0,0,0]),
  rotationY: z.number().default(0),
  actions: z.array(ActorActionSchema).max(80).default([])
});
export const ScenePropSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(['box','sphere','cylinder','plane']),
  position: Vector3Schema,
  scale: Vector3Schema.default([1,1,1]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#777777'),
  rotation: Vector3Schema.default([0,0,0]),
  castShadow: z.boolean().default(true)
});
export const CameraKeyframeSchema = z.object({
  atSeconds: z.number().nonnegative(),
  position: Vector3Schema,
  target: Vector3Schema,
  fov: z.number().min(15).max(100).default(40)
});
export const SceneCameraSchema = z.object({
  keyframes: z.array(CameraKeyframeSchema).min(1).max(30)
});
export const SceneLightingSchema = z.object({
  ambientColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
  ambientIntensity: z.number().min(0).max(5).default(1.2),
  keyColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
  keyIntensity: z.number().min(0).max(10).default(2),
  keyPosition: Vector3Schema.default([4,8,5]),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
});

export const SceneSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  durationSeconds: z.number().positive().max(90),
  narration: z.string().max(5000).default(''),
  visualDirection: z.string().min(1).max(4000),
  onScreenText: z.array(z.string().max(300)).max(20).default([]),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#101522'),
  actors: z.array(SceneActorSchema).max(40).optional(),
  props: z.array(ScenePropSchema).max(100).optional(),
  camera: SceneCameraSchema.optional(),
  lighting: SceneLightingSchema.optional()
});

export const ProductionSpecSchema = z.preprocess((input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const spec = input as Record<string, unknown>;
  const ratio = spec.aspectRatio;
  if (ratio !== '16:9' && ratio !== '9:16' && ratio !== '1:1') return input;

  let width = typeof spec.width === 'number' ? spec.width : undefined;
  let height = typeof spec.height === 'number' ? spec.height : undefined;

  if (width === undefined && height === undefined) {
    [width, height] = ratio === '16:9' ? [1280, 720] : ratio === '9:16' ? [720, 1280] : [1080, 1080];
  } else if (width === undefined && height !== undefined) {
    width = ratio === '16:9' ? Math.round(height * 16 / 9) : ratio === '9:16' ? Math.round(height * 9 / 16) : height;
  } else if (height === undefined && width !== undefined) {
    height = ratio === '16:9' ? Math.round(width * 9 / 16) : ratio === '9:16' ? Math.round(width * 16 / 9) : width;
  }

  return {...spec, width, height};
}, z.object({
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
  characters: z.array(CharacterAssetSchema).max(100).optional(),
  scenes: z.array(SceneSchema).min(1).max(30),
  projectFiles: ProjectFilesSchema.optional(),
  subtitles: z.array(z.object({start: z.number().nonnegative(), end: z.number().positive(), text: z.string().min(1).max(500)})).max(300).default([]),
  audio: z.object({
    musicEnabled: z.boolean().default(true),
    voiceEnabled: z.boolean().default(true),
    burnSubtitles: z.boolean().default(false),
    voice: z.string().min(1).max(120).default('en-US-AriaNeural'),
    musicStyle: z.enum(['ambient','uplifting','suspense']).default('ambient'),
    musicVolume: z.number().min(0).max(0.5).default(0.12),
    voiceVolume: z.number().min(0).max(2).default(1)
  }).default({musicEnabled:true,voiceEnabled:true,burnSubtitles:false,voice:'en-US-AriaNeural',musicStyle:'ambient',musicVolume:0.12,voiceVolume:1})
}).superRefine((spec, ctx) => {
  const sceneDuration = spec.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (Math.abs(sceneDuration - spec.durationSeconds) > 1) ctx.addIssue({code: 'custom', path: ['scenes'], message: 'Scene durations must add up to the requested runtime (±1 second).'});
  if (spec.aspectRatio === '9:16' && spec.width >= spec.height) ctx.addIssue({code: 'custom', path: ['width'], message: '9:16 output requires portrait dimensions.'});
  if (spec.aspectRatio === '16:9' && spec.width <= spec.height) ctx.addIssue({code: 'custom', path: ['width'], message: '16:9 output requires landscape dimensions.'});
  if (spec.aspectRatio === '1:1' && spec.width !== spec.height) ctx.addIssue({code: 'custom', path: ['width'], message: '1:1 output requires equal dimensions.'});
  const characterIds = new Set((spec.characters ?? []).map(character => character.id));
  if (characterIds.size !== (spec.characters ?? []).length) {
    ctx.addIssue({code:'custom',path:['characters'],message:'Character IDs must be unique within a production.'});
  }
  spec.scenes.forEach((scene, sceneIndex) => {
    (scene.actors ?? []).forEach((actor, actorIndex) => {
      if (!characterIds.has(actor.characterId)) {
        ctx.addIssue({code:'custom',path:['scenes',sceneIndex,'actors',actorIndex,'characterId'],message:'Every scene actor must reference a declared reusable character asset.'});
      }
      actor.actions.forEach((action, actionIndex) => {
        if (action.startSeconds + action.durationSeconds > scene.durationSeconds + 0.001) {
          ctx.addIssue({code:'custom',path:['scenes',sceneIndex,'actors',actorIndex,'actions',actionIndex],message:'Actor actions must finish within their scene timeline.'});
        }
        if (action.type === 'move' && !action.targetPosition) {
          ctx.addIssue({code:'custom',path:['scenes',sceneIndex,'actors',actorIndex,'actions',actionIndex,'targetPosition'],message:'Move actions require a targetPosition.'});
        }
        if (action.type === 'turn' && action.targetRotationY === undefined) {
          ctx.addIssue({code:'custom',path:['scenes',sceneIndex,'actors',actorIndex,'actions',actionIndex,'targetRotationY'],message:'Turn actions require targetRotationY.'});
        }
      });
    });
    const cameraKeys = scene.camera?.keyframes ?? [];
    for (let i = 0; i < cameraKeys.length; i++) {
      if (cameraKeys[i].atSeconds > scene.durationSeconds) {
        ctx.addIssue({code:'custom',path:['scenes',sceneIndex,'camera','keyframes',i,'atSeconds'],message:'Camera keyframes must fall within the scene timeline.'});
      }
      if (i > 0 && cameraKeys[i].atSeconds <= cameraKeys[i-1].atSeconds) {
        ctx.addIssue({code:'custom',path:['scenes',sceneIndex,'camera','keyframes',i,'atSeconds'],message:'Camera keyframes must be strictly chronological.'});
      }
    }
  });
}));

export const CreateJobSchema = z.object({production: ProductionSpecSchema});
export type ProductionSpec = z.infer<typeof ProductionSpecSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
