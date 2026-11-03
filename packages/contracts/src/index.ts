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
}).default({
  bodyColor: '#2563a6', skinColor: '#e8b58e', hairColor: '#171717',
  pantsColor: '#171a22', shoeColor: '#f2f2f2', eyeColor: '#171717',
  eyeEmissiveColor: '#000000', eyeEmissiveIntensity: 0, mouthColor: '#914d43',
  castShadow: true, receiveShadow: true, scale: 1
});
export const CharacterAssetSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  rig: z.enum(['block-humanoid']).default('block-humanoid'),
  appearance: CharacterAppearanceSchema
});
export const ActorActionSchema = z.object({
  type: z.enum(['idle','walk','run','wave','point','turn','jump','recoil','gesture','expression','move','disappear','appear','crouch','fall','clap','dance','talk','look-at']),
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
  environmentId: z.string().max(100).optional(),
  onScreenText: z.array(z.string().max(300)).max(20).default([]),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#101522'),
  actors: z.array(SceneActorSchema).max(40).optional(),
  props: z.array(ScenePropSchema).max(100).optional(),
  camera: SceneCameraSchema.optional(),
  lighting: SceneLightingSchema.optional()
});


/** Provider-neutral production-manifest building blocks. Optional on v1 jobs so
 * existing queued jobs remain readable while intake migrates to the richer contract. */
export const AssetReferenceSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['character','rig','environment','prop','material','texture','animation','music','voice','sound-effect','font','image','video']),
  uri: z.string().min(1).max(2000).optional(),
  version: z.string().max(80).optional(),
  required: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).default({})
});
export const EnvironmentSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(160),
  assetId: z.string().max(100).optional(),
  locationDescription: z.string().max(2000).default(''),
  timeOfDay: z.string().max(80).optional(),
  weather: z.string().max(120).optional(),
  atmosphere: z.string().max(1000).optional(),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#101522'),
  groundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#454a52'),
  groundSize: z.number().min(10).max(500).default(80),
  fog: z.object({color:z.string().regex(/^#[0-9a-fA-F]{6}$/),near:z.number().min(0).max(500),far:z.number().positive().max(1000)}).optional(),
  props: z.array(ScenePropSchema).max(150).default([]),
  lighting: SceneLightingSchema.optional(),
  continuityNotes: z.array(z.string().max(500)).max(30).default([])
});
export const ShotSchema = z.object({
  id: z.string().min(1).max(100),
  sceneId: z.string().min(1).max(80),
  title: z.string().max(160).default(''),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive().max(90),
  visualIntent: z.string().max(2000).default(''),
  camera: SceneCameraSchema.optional(),
  transitionIn: z.enum(['cut','dissolve','fade','wipe','match-cut']).default('cut'),
  transitionOut: z.enum(['cut','dissolve','fade','wipe','match-cut']).default('cut'),
  assetIds: z.array(z.string().min(1).max(100)).max(100).default([])
});
export const DialogueLineSchema = z.object({
  id: z.string().min(1).max(100),
  sceneId: z.string().min(1).max(80),
  characterId: z.string().max(80).optional(),
  speaker: z.string().min(1).max(120),
  text: z.string().min(1).max(5000),
  startSeconds: z.number().nonnegative().optional(),
  endSeconds: z.number().positive().optional(),
  voiceProfileId: z.string().max(100).optional(),
  delivery: z.string().max(500).optional()
});
export const AudioCueSchema = z.object({
  id: z.string().min(1).max(100),
  sceneId: z.string().min(1).max(80),
  type: z.enum(['music','ambience','foley','sound-effect','dialogue','narration']),
  assetId: z.string().max(100).optional(),
  label: z.string().min(1).max(160),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive().max(90).optional(),
  gainDb: z.number().min(-60).max(12).default(0),
  fadeInSeconds: z.number().nonnegative().default(0),
  fadeOutSeconds: z.number().nonnegative().default(0),
  duckingGroup: z.string().max(80).optional()
});
export const CaptionCueSchema = z.object({
  id: z.string().min(1).max(100),
  sceneId: z.string().min(1).max(80),
  text: z.string().min(1).max(500),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  kind: z.enum(['dialogue','narration','title','label','sfx']).default('narration'),
  speaker: z.string().max(120).optional(),
  emphasis: z.enum(['none','word','phrase']).default('none')
});
export const TimelineTrackSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(160),
  kind: z.enum(['actor','camera','audio','caption','visual-effect','property']),
  targetId: z.string().max(100).optional(),
  enabled: z.boolean().default(true),
  order: z.number().int().min(0).max(1000).default(0)
});
export const QualityRuleSchema = z.object({
  id: z.string().min(1).max(100),
  category: z.enum(['technical','continuity','story','visual','animation','audio','caption','safety']),
  severity: z.enum(['info','warning','error','blocking']).default('error'),
  description: z.string().min(1).max(1000),
  threshold: z.number().optional(),
  enabled: z.boolean().default(true)
});
export const OutputProfileSchema = z.object({
  id: z.string().min(1).max(100),
  width: z.number().int().min(320).max(3840),
  height: z.number().int().min(320).max(3840),
  fps: z.union([z.literal(24),z.literal(25),z.literal(30),z.literal(50),z.literal(60)]),
  codec: z.enum(['h264','h265','vp9']).default('h264'),
  container: z.enum(['mp4','webm']).default('mp4'),
  quality: z.enum(['preview','standard','master']).default('master')
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
  // Version 2 adds the provider-neutral production-manifest fields below.
  // Version 1 remains readable for queued jobs and existing API clients.
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
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

  assets: z.array(AssetReferenceSchema).max(1000).optional(),
  environments: z.array(EnvironmentSchema).max(100).optional(),
  shots: z.array(ShotSchema).max(300).optional(),
  tracks: z.array(TimelineTrackSchema).max(500).optional(),
  dialogue: z.array(DialogueLineSchema).max(1000).optional(),
  audioCues: z.array(AudioCueSchema).max(1000).optional(),
  captionCues: z.array(CaptionCueSchema).max(2000).optional(),
  outputProfiles: z.array(OutputProfileSchema).max(20).optional(),
  qaRules: z.array(QualityRuleSchema).max(200).optional(),
  projectMetadata: z.object({
    projectId: z.string().max(120).optional(),
    episodeId: z.string().max(120).optional(),
    language: z.string().max(35).default('en'),
    locale: z.string().max(35).optional(),
    targetPlatform: z.enum(['instagram-reels','youtube-shorts','youtube','tiktok','custom']).default('instagram-reels'),
    notes: z.array(z.string().max(1000)).max(100).default([])
  }).optional(),

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

  const uniqueIds = (values: Array<{id:string}>, path: string) => {
    const ids = values.map(value => value.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({code:'custom',path:[path],message:`${path} IDs must be unique.`});
  };
  uniqueIds(spec.assets ?? [], 'assets');
  uniqueIds(spec.environments ?? [], 'environments');
  uniqueIds(spec.shots ?? [], 'shots');
  uniqueIds(spec.tracks ?? [], 'tracks');
  uniqueIds(spec.dialogue ?? [], 'dialogue');
  uniqueIds(spec.audioCues ?? [], 'audioCues');
  uniqueIds(spec.captionCues ?? [], 'captionCues');
  const sceneIds = new Set(spec.scenes.map(scene => scene.id));
  const environmentIds = new Set((spec.environments ?? []).map(environment => environment.id));
  const characterIds = new Set((spec.characters ?? []).map(character => character.id));
  const assetIds = new Set((spec.assets ?? []).map(asset => asset.id));
  spec.scenes.forEach((scene,index) => {
    if (scene.environmentId && !environmentIds.has(scene.environmentId)) ctx.addIssue({code:'custom',path:['scenes',index,'environmentId'],message:'Scene environmentId must reference a declared environment.'});
  });
  (spec.environments ?? []).forEach((environment, index) => {
    if (environment.assetId && !assetIds.has(environment.assetId)) ctx.addIssue({code:'custom',path:['environments',index,'assetId'],message:'Environment assetId must reference a declared asset.'});
  });
  (spec.shots ?? []).forEach((shot, index) => {
    if (!sceneIds.has(shot.sceneId)) ctx.addIssue({code:'custom',path:['shots',index,'sceneId'],message:'Shot sceneId must reference a declared scene.'});
    if (shot.startSeconds + shot.durationSeconds > spec.durationSeconds + 0.001) ctx.addIssue({code:'custom',path:['shots',index],message:'Shot must finish within the production timeline.'});
    shot.assetIds.forEach((assetId, assetIndex) => {
      if (!assetIds.has(assetId)) ctx.addIssue({code:'custom',path:['shots',index,'assetIds',assetIndex],message:'Shot assetIds must reference declared assets.'});
    });
  });
  (spec.dialogue ?? []).forEach((line, index) => {
    if (!sceneIds.has(line.sceneId)) ctx.addIssue({code:'custom',path:['dialogue',index,'sceneId'],message:'Dialogue sceneId must reference a declared scene.'});
    if ((line.startSeconds === undefined) !== (line.endSeconds === undefined)) ctx.addIssue({code:'custom',path:['dialogue',index],message:'Dialogue timing requires both startSeconds and endSeconds.'});
    if (line.startSeconds !== undefined && line.endSeconds !== undefined && (line.endSeconds <= line.startSeconds || line.endSeconds > spec.durationSeconds + 0.001)) ctx.addIssue({code:'custom',path:['dialogue',index],message:'Dialogue timing must be ordered and within the production timeline.'});
  });
  (spec.audioCues ?? []).forEach((cue, index) => {
    if (!sceneIds.has(cue.sceneId)) ctx.addIssue({code:'custom',path:['audioCues',index,'sceneId'],message:'Audio cue sceneId must reference a declared scene.'});
    if (cue.assetId && !assetIds.has(cue.assetId)) ctx.addIssue({code:'custom',path:['audioCues',index,'assetId'],message:'Audio cue assetId must reference a declared asset.'});
    if (cue.startSeconds + (cue.durationSeconds ?? 0) > spec.durationSeconds + 0.001) ctx.addIssue({code:'custom',path:['audioCues',index],message:'Audio cue must finish within the production timeline.'});
    if (cue.fadeInSeconds + cue.fadeOutSeconds > (cue.durationSeconds ?? spec.durationSeconds)) ctx.addIssue({code:'custom',path:['audioCues',index],message:'Audio cue fades cannot exceed cue duration.'});
  });
  (spec.captionCues ?? []).forEach((cue, index) => {
    if (!sceneIds.has(cue.sceneId)) ctx.addIssue({code:'custom',path:['captionCues',index,'sceneId'],message:'Caption sceneId must reference a declared scene.'});
    if (cue.endSeconds <= cue.startSeconds || cue.endSeconds > spec.durationSeconds + 0.001) ctx.addIssue({code:'custom',path:['captionCues',index],message:'Caption timing must be ordered and within the production timeline.'});
  });
  (spec.tracks ?? []).forEach((track, index) => {
    if (track.targetId && track.kind === 'actor' && !characterIds.has(track.targetId)) ctx.addIssue({code:'custom',path:['tracks',index,'targetId'],message:'Actor tracks must reference declared character assets.'});
    if (track.targetId && track.kind === 'camera' && !sceneIds.has(track.targetId)) ctx.addIssue({code:'custom',path:['tracks',index,'targetId'],message:'Camera track targetId must reference a scene.'});
  });
  (spec.outputProfiles ?? []).forEach((profile, index) => {
    if (profile.width / profile.height !== spec.width / spec.height) ctx.addIssue({code:'custom',path:['outputProfiles',index],message:'Output profile aspect ratio must match the production aspect ratio.'});
  });


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
        if (action.type === 'look-at' && !action.targetPosition) {
          ctx.addIssue({code:'custom',path:['scenes',sceneIndex,'actors',actorIndex,'actions',actionIndex,'targetPosition'],message:'Look-at actions require a targetPosition.'});
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

/** Upgrade a validated v1 production to the current manifest version.
 * The migration is additive: existing scene and audio data are preserved,
 * and all newly introduced manifest collections retain their schema defaults.
 */
export function migrateProductionSpec(input: unknown): ProductionSpec {
  const parsed = ProductionSpecSchema.parse(input);
  if (parsed.schemaVersion === 2) return parsed;
  return ProductionSpecSchema.parse({...parsed, schemaVersion: 2});
}
export type JobStatus = z.infer<typeof JobStatusSchema>;
