import { ProductionSpecSchema, type ProductionSpec } from '@film-studio/contracts';

export interface PlannerConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
}

function stripJsonFence(value: string): string {
  return value.trim().replace(/^\`\`\`(?:json)?\\s*/i,'').replace(/\\s*\`\`\`$/,'').trim();
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
  const baseUrl = config.baseUrl.replace(/\\/$/,'');
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
          'Preserve source chronology, causality, character continuity, scene beats and stated runtime. If runtime is absent, target 60 seconds. Use 9:16, 1080x1920, 30 FPS unless source specifies otherwise.',
          'Return schemaVersion 2, title, idea, styleId, durationSeconds, aspectRatio, fps, width, height, scenes and audio. Every scene needs id,title,durationSeconds,visualDirection,narration,onScreenText,background.',
          'Scene durations must sum to durationSeconds within one second. Keep narration concise enough to fit the scene timing.',
          'Create a coherent shot/scene plan in visualDirection, describing camera, environment, actor blocking, action, lighting and transition. Do not use image slideshows.',
          'Use a distinct scene for each meaningful beat, up to 30 scenes. Use hex colors for backgrounds.',
          'Output valid JSON only, no Markdown.'
        ].join(' ')},
        {role:'user',content:`SOURCE PRODUCTION BIBLE / STORY:\\n\\n${source}\\n\\nReturn a valid ProductionSpec JSON object.`}
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
