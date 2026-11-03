import { ProductionSpecSchema, type ProductionSpec } from '@film-studio/contracts';

export interface PlannerConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
  defaults?: {styleId?:string | null;aspectRatio?:'16:9'|'9:16'|'1:1'};
}

function stripJsonFence(value: string): string {
  let result = value.trim();
  if (result.startsWith("```json")) result = result.slice(7);
  else if (result.startsWith("```")) result = result.slice(3);
  if (result.trimEnd().endsWith("```")) result = result.trimEnd().slice(0,-3);
  return result.trim();
}

export function parseStructuredProductionSpec(sourceText: string): ProductionSpec | null {
  try {
    const parsed = JSON.parse(sourceText) as unknown;
    const candidate = parsed && typeof parsed === 'object' && 'production' in parsed
      ? (parsed as {production?:unknown}).production
      : parsed;
    const validated = ProductionSpecSchema.safeParse(candidate);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

export async function planProductionFromSource(
  sourceText: string,
  config: PlannerConfig
): Promise<ProductionSpec> {
  const source = sourceText.trim();
  if (!source) throw new Error('The extracted production source is empty.');
  if (source.length > 60_000) throw new Error('The extracted source exceeds the 60,000-character planning limit.');
  if (!config.apiKey || !config.model || !config.baseUrl) throw new Error('AI planner is not configured. Set AI_API_KEY, AI_MODEL and optionally AI_BASE_URL.');
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0,-1) : config.baseUrl;
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method:'POST',
    headers:{
      authorization:`Bearer ${config.apiKey}`,
      'content-type':'application/json',
      ...(baseUrl.includes('openrouter.ai') ? {'HTTP-Referer':'https://film-studio-api.onrender.com','X-Title':'Real Factory'} : {})
    },
    body:JSON.stringify({
      model:config.model,
      temperature:0.2,
      response_format:{type:'json_object'},
      messages:[
        {role:'system',content:[
          'You are the production planner for Real Factory, a generic animated-film production pipeline.',
          'Convert the supplied story/script/production Bible into one complete JSON ProductionSpec.',
          'Do not invent essential plot facts, character identities, dialogue, locations or story outcomes absent from the source. Mark material ambiguity in projectMetadata.notes.',
          'Preserve source chronology, causality, character continuity, scene beats and stated runtime. If runtime is absent, target 60 seconds. Use requested project style and aspect-ratio defaults when supplied; otherwise use 9:16, 1080x1920, 30 FPS unless source specifies otherwise.',
          'Use block-humanoid as the default character rig. Only use gltf-humanoid when the supplied production data already declares a matching rig or character asset reference; never invent a library asset key or version.',
          'Return schemaVersion 2, title, idea, styleId, durationSeconds, aspectRatio, fps, width, height, characters, environments, scenes and audio. Character entries need id,name,rig:block-humanoid and appearance. Environment entries need id,name,locationDescription,background,groundColor,props and continuityNotes. Every scene needs id,title,durationSeconds,visualDirection,narration,onScreenText,background,environmentId,actors,props,camera and lighting. Actor entries need characterId,position,rotationY,actions. Camera needs keyframes with atSeconds,position,target and fov. Use only supported actor action types and include targetPosition for move/look-at and targetRotationY for turn.',
          'Scene durations must sum to durationSeconds within one second. Keep narration concise enough to fit the scene timing.',
          'Create a coherent shot/scene plan in visualDirection, describing camera, environment, actor blocking, action, lighting and transition. Do not use image slideshows. For every recurring named character, define one reusable characters entry with stable id, name and rig block-humanoid; reference it from scene actors. Include at least one camera keyframe per scene so the generic 3D renderer is selected. Put appropriate actions on actors and keep every action inside its scene duration.',
          'Create audioCues for meaningful production sound: ambience, foley and sound-effect; use the audio musicStyle setting for the continuous score, each with unique id, sceneId, type (ambience, foley or sound-effect), descriptive label, absolute startSeconds, durationSeconds, gainDb, fadeInSeconds and fadeOutSeconds. Do not create dialogue or narration cues that duplicate generated speech. Keep all cue timing within the production runtime.',\n          'Create captionCues for non-spoken titles, labels and intentional on-screen text with unique id, sceneId, text, absolute startSeconds and endSeconds, kind and optional emphasis. Spoken-word captions are generated from genuine TTS word boundaries; do not duplicate each spoken word as a separate caption cue.',\n          'When characters speak, create timed dialogue entries with id,sceneId,characterId,speaker,text,startSeconds,endSeconds and voiceProfileId; define matching reusable voiceProfiles using provider edge-tts, voice, rate, pitch and volume. Do not duplicate dialogue text in scene narration. Dialogue startSeconds and endSeconds are absolute seconds from the start of the full production. Actor action startSeconds are local to their scene; convert the dialogue window to scene-local seconds when adding the talk action.',
          'Use a distinct scene for each meaningful beat, up to 30 scenes. Use hex colors for backgrounds.',
          'Output valid JSON only, no Markdown.'
        ].join(' ')},
        {role:'user',content:`PROJECT DEFAULTS (honor unless the source explicitly overrides them):\\nstyleId: ${config.defaults?.styleId || 'choose an appropriate generic cinematic style'}\\naspectRatio: ${config.defaults?.aspectRatio || '9:16'}\\n\\nSOURCE PRODUCTION BIBLE / STORY:\\n\\n${source}\\n\\nReturn a valid ProductionSpec JSON object.`}
      ]
    }),
    signal:AbortSignal.timeout(90_000)
  });
  if (!response.ok) throw new Error(`AI planner request failed (${response.status}): ${(await response.text()).slice(0,500)}`);
  const payload = await response.json() as {choices?:Array<{message?:{content?:string|null}}>};
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI planner returned no message content.');
  let candidate: unknown;
  try { candidate = JSON.parse(stripJsonFence(content)); }
  catch { throw new Error('AI planner returned malformed JSON.'); }
  const validated = ProductionSpecSchema.safeParse(candidate);
  if (!validated.success) throw new Error(`AI planner output failed production contract validation: ${validated.error.issues.slice(0,8).map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  return validated.data;
}
