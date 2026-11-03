import Fastify from 'fastify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CreateJobSchema } from '@film-studio/contracts';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { extractProductionInput } from './intake.js';
import { planProductionFromSource } from './planner.js';
import { createSupabaseApiKeyFetch } from './supabase-api-key-fetch.js';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const app = Fastify({logger: true, bodyLimit: 8_000_000});
const env = (key: string) => process.env[key];
const apiToken = env('API_TOKEN');
const workerSecret = env('RENDERER_SHARED_SECRET');
const supabaseUrl = env('SUPABASE_URL')?.trim();
// Prefer the current opaque secret key. Supabase requires sb_secret_* keys in
// the apikey header only; supabase-js normally mirrors its key into Authorization.
const serviceKey = (env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'))?.trim();
const supabaseApiKeyFetch = createSupabaseApiKeyFetch();
const githubActionsToken = env('GITHUB_ACTIONS_TOKEN');

async function dispatchRenderer(requestLog?: { warn: (obj: unknown, message?: string) => void }) {
  if (!githubActionsToken) {
    requestLog?.warn('GITHUB_ACTIONS_TOKEN is not configured; queued jobs will be picked up by the five-minute scheduled renderer.');
    return 'scheduled_fallback' as const;
  }
  try {
    const response = await fetch('https://api.github.com/repos/abhradeep2024-cell/towntales-ai/actions/workflows/render-worker.yml/dispatches', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${githubActionsToken}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        'user-agent': 'chatgpt-film-studio'
      },
      body: JSON.stringify({ ref: 'main' })
    });
    if (!response.ok) throw new Error(`GitHub workflow dispatch failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
    return 'dispatched' as const;
  } catch (error) {
    requestLog?.warn({ err: error }, 'Renderer dispatch failed; scheduled queue polling remains enabled.');
    return 'scheduled_fallback' as const;
  }
}
const bucket = env('SUPABASE_STORAGE_BUCKET') ?? 'towntales-assets';
let supabase: SupabaseClient | undefined;
if (supabaseUrl && serviceKey) supabase = createClient(supabaseUrl, serviceKey, {auth:{persistSession:false,autoRefreshToken:false},global:{fetch:supabaseApiKeyFetch}});

function bearer(request: {headers: Record<string, unknown>}) {
  const value = request.headers.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : '';
}
function requireSecret(request: {headers: Record<string, unknown>}, expected: string | undefined) {
  return Boolean(expected && bearer(request) && bearer(request) === expected);
}
function requireDb() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

app.get('/', async () => ({ok:true,service:'film-studio-api',health:'/health',schema:'/openapi.yaml'}));

app.get('/health', async (_request, reply) => {
  if (!supabase) return reply.code(503).send({ok:false,service:'film-studio-api',databaseConfigured:false,databaseConnected:false});
  const {error} = await supabase.from('film_studio_jobs').select('id',{head:true}).limit(1);
  if (error) {
    app.log.error({code:error.code,message:error.message,details:error.details,hint:error.hint},'Supabase health query failed');
    return reply.code(503).send({ok:false,service:'film-studio-api',databaseConfigured:true,databaseConnected:false});
  }
  return {ok:true,service:'film-studio-api',databaseConfigured:true,databaseConnected:true};
});

app.get('/openapi.yaml', async (_request, reply) => {
  try {
    const schema = await readFile(join(appRoot, 'openapi.yaml'), 'utf8');
    return reply.type('application/yaml; charset=utf-8').send(schema);
  } catch {
    return reply.code(404).send({error:'openapi_schema_not_found'});
  }
});

let styleCatalogCache: any;
async function getStyleCatalog() {
  if (!styleCatalogCache) {
    const raw = await readFile(join(appRoot, 'packages', 'contracts', 'src', 'lemo-style-catalog.json'), 'utf8');
    styleCatalogCache = JSON.parse(raw);
  }
  return styleCatalogCache;
}

const styleGuideCache = new Map<string, string>();
const styleEngineCache = new Map<string, string>();
let styleEngineIndexCache: any;
async function getStyleEngineIndex() {
  if (!styleEngineIndexCache) {
    const raw = await readFile(join(appRoot, 'packages', 'contracts', 'src', 'lemo-engine-index.json'), 'utf8');
    styleEngineIndexCache = JSON.parse(raw);
  }
  return styleEngineIndexCache;
}

app.get('/v1/styles', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  try {
    const query = request.query as {q?:string;category?:string};
    const catalog = await getStyleCatalog();
    const q = (query.q ?? '').trim().toLowerCase();
    const category = (query.category ?? '').trim().toLowerCase();
    const styles = catalog.styles.filter((style: any) =>
      (!q || [style.slug,style.name,style.nameZh,style.demo].some((value:string) => String(value).toLowerCase().includes(q))) &&
      (!category || style.category.toLowerCase() === category)
    );
    return {source:catalog.source,sourceCommit:catalog.sourceCommit,count:styles.length,styles};
  } catch (error) {
    request.log.error(error); return reply.code(503).send({error:'style_catalog_unavailable'});
  }
});

app.get('/v1/styles/:slug', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  const {slug} = request.params as {slug:string};
  try {
    const catalog = await getStyleCatalog();
    const style = catalog.styles.find((item:any) => item.slug === slug);
    if (!style) return reply.code(404).send({error:'style_not_found'});
    let guide = styleGuideCache.get(slug);
    if (!guide) {
      const url = `https://raw.githubusercontent.com/lemomo-ai/lemo-opuscar/${catalog.sourceCommit}/styles/${slug}/STYLE.md`;
      const response = await fetch(url, {signal:AbortSignal.timeout(8000)});
      if (!response.ok) return reply.code(502).send({error:'style_guide_fetch_failed'});
      guide = await response.text();
      if (guide.length > 25_000) guide = guide.slice(0,25_000);
      styleGuideCache.set(slug,guide);
    }
    return {style,styleGuide:guide,sourceCommit:catalog.sourceCommit};
  } catch (error) {
    request.log.error(error); return reply.code(503).send({error:'style_guide_unavailable'});
  }
});

app.get('/v1/styles/:slug/engine', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  const {slug} = request.params as {slug:string};
  const query = request.query as {file?:string};
  try {
    const catalog = await getStyleCatalog();
    const style = catalog.styles.find((item:any) => item.slug === slug);
    if (!style) return reply.code(404).send({error:'style_not_found'});
    const engineIndex = await getStyleEngineIndex();
    const files = engineIndex.styles[slug] ?? [];
    if (!query.file) {
      return {
        style,
        sourceCommit:engineIndex.sourceCommit,
        engineFiles:files.filter((file:any) => file.role === 'engine'),
        bootstrapFiles:files.filter((file:any) => file.role === 'bootstrap'),
        demoReferenceFiles:files.filter((file:any) => file.role === 'demo-reference'),
        instruction:'Read engine files as technical references. Bootstrap and demo-reference files may contain the example film’s story, timeline, dialogue, shots or assets; do not reuse those creative elements.'
      };
    }
    const selected = files.find((file:any) => file.path === query.file);
    if (!selected) return reply.code(404).send({error:'engine_file_not_found'});
    const cacheKey = `${slug}/${selected.path}`;
    let content = styleEngineCache.get(cacheKey);
    if (!content) {
      const url = `https://raw.githubusercontent.com/lemomo-ai/lemo-opuscar/${engineIndex.sourceCommit}/styles/${slug}/demo/${selected.path}`;
      const response = await fetch(url,{signal:AbortSignal.timeout(10000)});
      if (!response.ok) return reply.code(502).send({error:'engine_source_unavailable'});
      content = await response.text();
      if (Buffer.byteLength(content,'utf8') > engineIndex.maxFileBytes) return reply.code(413).send({error:'engine_source_too_large'});
      styleEngineCache.set(cacheKey,content);
    }
    return {styleSlug:slug,file:selected.path,role:selected.role,bytes:Buffer.byteLength(content,'utf8'),sourceCommit:engineIndex.sourceCommit,content};
  } catch (error) {
    request.log.error(error); return reply.code(503).send({error:'style_engine_unavailable'});
  }
});



const libraryAssetTypes = ['character','rig','environment','prop','material','texture','animation','music','voice','sound-effect','font','image','video','other'] as const;
const libraryMimeTypes = new Set([
  'application/json','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain',
  'image/png','image/jpeg','image/webp','image/svg+xml',
  'audio/mpeg','audio/wav','audio/ogg','audio/mp4',
  'video/mp4','font/woff','font/woff2'
]);

app.post('/v1/assets', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  const body = request.body as {assetKey?:string;version?:number;assetType?:string;displayName?:string;filename?:string;mimeType?:string;contentBase64?:string;metadata?:Record<string,unknown>;provenance?:Record<string,unknown>};
  if (!body || typeof body.assetKey !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(body.assetKey) ||
      !Number.isSafeInteger(body.version) || (body.version ?? 0) < 1 ||
      !libraryAssetTypes.includes(body.assetType as typeof libraryAssetTypes[number]) ||
      typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.length > 160 ||
      typeof body.filename !== 'string' || typeof body.mimeType !== 'string' || !libraryMimeTypes.has(body.mimeType) || typeof body.contentBase64 !== 'string') {
    return reply.code(400).send({error:'invalid_asset_metadata'});
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.contentBase64)) return reply.code(400).send({error:'invalid_base64_content'});
  const bytes = Buffer.from(body.contentBase64,'base64');
  if (!bytes.length || bytes.toString('base64') !== body.contentBase64 || bytes.byteLength > 5 * 1024 * 1024) return reply.code(413).send({error:'invalid_or_oversized_asset'});
  const filename = body.filename.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);
  if (!filename || filename.includes('..')) return reply.code(400).send({error:'invalid_asset_filename'});
  const storageKey = `library/${body.assetKey}/v${body.version}/${filename}`;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const db = requireDb();
  try {
    const {error:uploadError} = await db.storage.from(bucket).upload(storageKey,bytes,{contentType:body.mimeType,upsert:false});
    if (uploadError) throw uploadError;
    const {data,error} = await db.from('film_studio_asset_library').insert({
      asset_key:body.assetKey,version:body.version,asset_type:body.assetType,display_name:body.displayName.trim(),
      storage_key:storageKey,mime_type:body.mimeType,byte_size:bytes.byteLength,sha256,
      metadata:body.metadata ?? {},provenance:body.provenance ?? {},status:'ready'
    }).select('id,asset_key,version,asset_type,display_name,mime_type,byte_size,sha256,status,created_at').single();
    if (error) {
      try { await db.storage.from(bucket).remove([storageKey]); } catch { /* best-effort rollback */ }
      throw error;
    }
    return reply.code(201).send(data);
  } catch (error) {
    request.log.error(error,'Reusable asset registration failed');
    return reply.code(503).send({error:'asset_registration_failed'});
  }
});

app.get('/v1/assets', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  const query = request.query as {type?:string;q?:string;limit?:string};
  const limit = Math.min(100,Math.max(1,Number.parseInt(query.limit ?? '50',10) || 50));
  if (query.type && !libraryAssetTypes.includes(query.type as typeof libraryAssetTypes[number])) return reply.code(400).send({error:'invalid_asset_type'});
  try {
    const db = requireDb();
    let select = db.from('film_studio_asset_library')
      .select('id,asset_key,version,asset_type,display_name,storage_key,mime_type,byte_size,sha256,metadata,status,created_at')
      .eq('status','ready').order('display_name').limit(limit);
    if (query.type) select = select.eq('asset_type',query.type);
    if (query.q?.trim()) select = select.ilike('display_name',`%${query.q.trim().slice(0,80)}%`);
    const {data,error} = await select;
    if (error) throw error;
    const assets = await Promise.all((data ?? []).map(async (asset:any) => {
      const {data:signed,error:signError} = await db.storage.from(bucket).createSignedUrl(asset.storage_key,300);
      if (signError || !signed?.signedUrl) throw signError ?? new Error(`Could not sign asset ${asset.asset_key}.`);
      const {storage_key,...publicMetadata} = asset;
      return {...publicMetadata,url:signed.signedUrl,expiresInSeconds:300};
    }));
    return {count:assets.length,assets};
  } catch (error) {
    request.log.error(error,'Reusable asset lookup failed');
    return reply.code(503).send({error:'asset_lookup_failed'});
  }
});

app.post('/v1/intake', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  const body = request.body as {filename?:string;contentBase64?:string;title?:string;description?:string;styleId?:string;aspectRatio?:'16:9'|'9:16'|'1:1'};
  if (!body || typeof body.filename !== 'string' || typeof body.contentBase64 !== 'string') {
    return reply.code(400).send({error:'filename_and_base64_content_required'});
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.contentBase64)) {
    return reply.code(400).send({error:'invalid_base64_content'});
  }
  const bytes = Buffer.from(body.contentBase64,'base64');
  if (bytes.toString('base64') !== body.contentBase64 || bytes.byteLength > 5 * 1024 * 1024) {
    return reply.code(413).send({error:'invalid_or_oversized_source_file'});
  }
  let extracted;
  try { extracted = await extractProductionInput(body.filename,bytes); }
  catch (error) {
    return reply.code(400).send({error:'source_extraction_failed',message:error instanceof Error ? error.message : 'Unknown extraction error'});
  }
  const db = requireDb();
  const id = randomUUID();
  const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);
  const sourceKey = `intake/${id}/source-${safeName}`;
  const textKey = `intake/${id}/extracted.txt`;
  const mime = extracted.format === 'docx'
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : extracted.format === 'json' ? 'application/json' : 'text/plain';
  let projectId: string | undefined;
  const uploadedKeys: string[] = [];
  try {
    const title = (body.title ?? body.filename.replace(/\\.[^.]+$/,'')).trim().slice(0,160);
    if (!title) return reply.code(400).send({error:'project_title_required'});
    const aspectRatio = body.aspectRatio ?? '9:16';
    if (!['16:9','9:16','1:1'].includes(aspectRatio)) return reply.code(400).send({error:'invalid_aspect_ratio'});
    const {data:project,error:projectError} = await db.from('film_studio_projects').insert({
      title,description:typeof body.description === 'string' ? body.description.slice(0,4000) : null,
      default_style_id:typeof body.styleId === 'string' ? body.styleId.slice(0,100) : null,
      default_aspect_ratio:aspectRatio
    }).select('id,title,created_at').single();
    if (projectError) throw projectError;
    projectId = project.id;
    const {error:sourceError} = await db.storage.from(bucket).upload(sourceKey,bytes,{contentType:mime,upsert:false});
    if (sourceError) throw sourceError;
    uploadedKeys.push(sourceKey);
    const extractedBytes = Buffer.from(extracted.text,'utf8');
    const {error:textError} = await db.storage.from(bucket).upload(textKey,extractedBytes,{contentType:'text/plain',upsert:false});
    if (textError) throw textError;
    uploadedKeys.push(textKey);
    const {error:assetError} = await db.from('film_studio_assets').insert([
      {project_id:projectId,asset_type:'data',storage_key:sourceKey,mime_type:mime,byte_size:bytes.byteLength,metadata:{role:'original-production-input',filename:safeName,format:extracted.format}},
      {project_id:projectId,asset_type:'data',storage_key:textKey,mime_type:'text/plain',byte_size:extractedBytes.byteLength,metadata:{role:'extracted-production-text',sourceFilename:safeName,format:extracted.format}}
    ]);
    if (assetError) throw assetError;
    return reply.code(201).send({
      project,source:{filename:safeName,format:extracted.format,bytes:bytes.byteLength,extractedCharacters:extracted.text.length},
      warnings:extracted.warnings,
      nextStage:'story_interpretation_not_started'
    });
  } catch (error) {
    request.log.error(error,'Production intake persistence failed');
    try { if (uploadedKeys.length) await db.storage.from(bucket).remove(uploadedKeys); } catch { /* best-effort rollback */ }
    try { if (projectId) await db.from('film_studio_projects').delete().eq('id',projectId); } catch { /* best-effort rollback */ }
    return reply.code(503).send({error:'production_intake_persistence_failed'});
  }
});


app.post('/v1/projects/:id/plan', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  const {id} = request.params as {id:string};
  const aiKey = env('AI_API_KEY') || env('OPENAI_API_KEY') || env('OPENROUTER_API_KEY');
  const aiModel = env('AI_MODEL');
  const defaultProvider = env('AI_API_KEY') || env('OPENAI_API_KEY') ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1';
  const aiBaseUrl = env('AI_BASE_URL') || defaultProvider;
  if (!aiKey || !aiModel) return reply.code(503).send({error:'ai_planner_not_configured',requiredEnvironment:['AI_API_KEY','AI_MODEL'],optionalEnvironment:['AI_BASE_URL']});
  try {
    const db = requireDb();
    const {data:assets,error:assetError} = await db.from('film_studio_assets')
      .select('storage_key,metadata').eq('project_id',id);
    if (assetError) throw assetError;
    const sourceAsset = (assets ?? []).find((asset:any) => asset.metadata?.role === 'extracted-production-text');
    if (!sourceAsset?.storage_key) return reply.code(404).send({error:'extracted_project_source_not_found'});
    const {data:sourceBlob,error:downloadError} = await db.storage.from(bucket).download(sourceAsset.storage_key);
    if (downloadError || !sourceBlob) throw downloadError ?? new Error('Could not download extracted production source.');
    const sourceText = await sourceBlob.text();
    const production = await planProductionFromSource(sourceText,{apiKey:aiKey,baseUrl:aiBaseUrl,model:aiModel});
    const validated = CreateJobSchema.safeParse({production:{
      ...production,
      projectMetadata:{...(production.projectMetadata ?? {}),projectId:id}
    }});
    if (!validated.success) return reply.code(422).send({error:'planned_production_failed_validation',details:validated.error.flatten()});
    const {data:project,error:projectError} = await db.from('film_studio_projects').select('id,title').eq('id',id).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return reply.code(404).send({error:'project_not_found'});
    const {data:job,error:jobError} = await db.from('film_studio_jobs').insert({
      project_id:id,title:validated.data.production.title || project.title,
      idea:validated.data.production.idea,status:'queued',progress:0,
      production_specification:validated.data.production
    }).select('id,status,progress,created_at').single();
    if (jobError) throw jobError;
    const renderDispatch = await dispatchRenderer(request.log);
    return reply.code(202).send({ ...job, projectId:id, renderDispatch, plan:{sceneCount:validated.data.production.scenes.length,durationSeconds:validated.data.production.durationSeconds,aspectRatio:validated.data.production.aspectRatio} });
  } catch (error) {
    request.log.error(error,'Story interpretation and planning failed');
    const message = error instanceof Error ? error.message : 'Unknown planning error';
    const providerFailure = /AI planner request failed|AI planner returned|AI planner output/i.test(message);
    return reply.code(providerFailure ? 502 : 503).send({error:'story_planning_failed',message:message.slice(0,1000)});
  }
});

app.post('/v1/jobs', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  const parsed = CreateJobSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({error:'invalid_production_specification',details:parsed.error.flatten()});
  try {
    const {data,error} = await requireDb().from('film_studio_jobs').insert({
      title:parsed.data.production.title, idea:parsed.data.production.idea, status:'queued', progress:0,
      production_specification:parsed.data.production
    }).select('id,status,progress,created_at').single();
    if (error) throw error;
    const renderDispatch = await dispatchRenderer(request.log);
    return reply.code(202).send({ ...data, renderDispatch });
  } catch (error) {
    request.log.error(error); return reply.code(503).send({error:'job_creation_failed'});
  }
});

app.get('/v1/jobs/:id', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  const {id} = request.params as {id:string};
  try {
    const {data,error} = await requireDb().from('film_studio_jobs').select('id,title,status,progress,error,output_bytes,qc_report,created_at,updated_at').eq('id',id).maybeSingle();
    if (error) throw error;
    if (!data) return reply.code(404).send({error:'job_not_found'});
    return data;
  } catch (error) {
    request.log.error(error); return reply.code(503).send({error:'job_lookup_failed'});
  }
});

app.get('/v1/jobs/:id/artifacts', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  const {id} = request.params as {id:string};
  try {
    const db = requireDb();
    const {data:job,error} = await db.from('film_studio_jobs').select('status,qc_report').eq('id',id).maybeSingle();
    if (error) throw error;
    if (!job) return reply.code(404).send({error:'job_not_found'});
    if (job.status !== 'completed') return reply.code(409).send({error:'artifacts_not_ready'});
    const stored = (job.qc_report as any)?.artifacts ?? {};
    const artifacts: Record<string, unknown> = {};
    for (const [name, metadata] of Object.entries(stored) as Array<[string, any]>) {
      const objectKey = metadata?.objectKey;
      if (typeof objectKey !== 'string' || !objectKey || objectKey.includes('..')) continue;
      const {data,error:signError} = await db.storage.from(bucket).createSignedUrl(objectKey,300);
      if (signError || !data?.signedUrl) throw signError ?? new Error(`Could not sign artifact ${name}.`);
      artifacts[name] = {
        url: data.signedUrl, expiresInSeconds: 300,
        bytes: metadata.bytes, sha256: metadata.sha256
      };
    }
    return {artifacts};
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({error:'artifact_retrieval_failed'});
  }
});

app.post('/internal/jobs/claim', async (request, reply) => {
  if (!requireSecret(request, workerSecret)) return reply.code(401).send({error:'unauthorized'});
  try {
    const {data,error} = await requireDb().rpc('claim_film_studio_job');
    if (error) throw error; return {job:data ?? null};
  } catch (error) {
    request.log.error(error); return reply.code(503).send({error:'claim_failed'});
  }
});

app.post('/internal/jobs/:id/progress', async (request, reply) => {
  if (!requireSecret(request, workerSecret)) return reply.code(401).send({error:'unauthorized'});
  const {id} = request.params as {id:string};
  const body = request.body as {status?:string;progress?:number;error?:string};
  const allowed = ['rendering','uploading','completed','failed','cancelled'];
  if (!body || (body.status && !allowed.includes(body.status)) || (body.progress !== undefined && (!Number.isInteger(body.progress) || body.progress < 0 || body.progress > 100))) return reply.code(400).send({error:'invalid_progress_update'});
  try {
    const patch:Record<string,unknown> = {updated_at:new Date().toISOString()};
    if (body.status) patch.status = body.status;
    if (body.progress !== undefined) patch.progress = body.progress;
    if (body.error) patch.error = body.error.slice(0,2000);
    const {data,error} = await requireDb().from('film_studio_jobs').update(patch).eq('id',id).select('id,status,progress').single();
    if (error) throw error; return data;
  } catch (error) {
    request.log.error(error); return reply.code(503).send({error:'progress_update_failed'});
  }
});

app.post('/internal/jobs/:id/complete', async (request, reply) => {
  if (!requireSecret(request, workerSecret)) return reply.code(401).send({error:'unauthorized'});
  const {id} = request.params as {id:string};
  const body = request.body as {outputKey?:string;outputBytes?:number;qcReport?:Record<string,unknown>};
  if (!body?.outputKey || body.outputKey.includes('..') || !Number.isSafeInteger(body.outputBytes) || (body.outputBytes ?? 0) <= 0 || !body.qcReport) return reply.code(400).send({error:'invalid_completion_payload'});
  try {
    const {data,error} = await requireDb().from('film_studio_jobs').update({
      status:'completed',progress:100,output_key:body.outputKey,output_bytes:body.outputBytes,qc_report:body.qcReport,updated_at:new Date().toISOString()
    }).eq('id',id).eq('status','uploading').select('id,status,output_bytes').single();
    if (error) throw error; return data;
  } catch (error) {
    request.log.error(error); return reply.code(503).send({error:'completion_update_failed'});
  }
});

app.post('/v1/jobs/:id/retry', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({ error: 'unauthorized' });
  const { id } = request.params as { id: string };
  try {
    const db = requireDb();
    const { data: existing, error: readError } = await db.from('film_studio_jobs')
      .select('id,status,attempt_count,max_attempts').eq('id', id).maybeSingle();
    if (readError) throw readError;
    if (!existing) return reply.code(404).send({ error: 'job_not_found' });
    if (existing.status !== 'failed' || existing.attempt_count >= existing.max_attempts) {
      return reply.code(409).send({ error: 'job_not_retryable', attemptCount: existing.attempt_count, maxAttempts: existing.max_attempts });
    }
    const { data, error } = await db.from('film_studio_jobs').update({
      status: 'queued', progress: 0, error: null, output_key: null, output_bytes: null, qc_report: null, updated_at: new Date().toISOString()
    }).eq('id', id).eq('status', 'failed').eq('attempt_count', existing.attempt_count).select('id,status,progress').maybeSingle();
    if (error) throw error;
    if (!data) return reply.code(409).send({ error: 'job_state_changed_retry_again' });
    const renderDispatch = await dispatchRenderer(request.log);
    return reply.code(202).send({ ...data, renderDispatch });
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ error: 'job_retry_failed' });
  }
});

app.post('/v1/jobs/:id/cancel', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  const {id} = request.params as {id:string};
  try {
    const {data,error} = await requireDb().from('film_studio_jobs').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',id).in('status',['queued','rendering']).select('id,status').maybeSingle();
    if (error) throw error;
    if (!data) return reply.code(409).send({error:'job_not_cancellable'});
    return data;
  } catch (error) {
    request.log.error(error); return reply.code(503).send({error:'cancellation_failed'});
  }
});

app.get('/v1/jobs/:id/output', async (request, reply) => {
  if (!requireSecret(request, apiToken)) return reply.code(401).send({error:'unauthorized'});
  const {id} = request.params as {id:string};
  try {
    const db = requireDb();
    const {data:job,error} = await db.from('film_studio_jobs').select('status,output_key').eq('id',id).maybeSingle();
    if (error) throw error;
    if (!job) return reply.code(404).send({error:'job_not_found'});
    if (job.status !== 'completed' || !job.output_key) return reply.code(409).send({error:'output_not_ready'});
    const {data,error:signError} = await db.storage.from(bucket).createSignedUrl(job.output_key,300);
    if (signError) throw signError;
    return {url:data.signedUrl,expiresInSeconds:300};
  } catch (error) {
    request.log.error(error); return reply.code(503).send({error:'output_retrieval_failed'});
  }
});

const port = Number(env('PORT') ?? 8080);
if (env('NODE_ENV') !== 'test') {
  app.listen({host:'0.0.0.0',port}).catch((error) => {app.log.error(error);process.exit(1);});
}
