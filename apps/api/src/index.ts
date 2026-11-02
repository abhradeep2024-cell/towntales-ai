import Fastify from 'fastify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CreateJobSchema } from '@film-studio/contracts';

const app = Fastify({logger: true, bodyLimit: 1_000_000});
const env = (key: string) => process.env[key];
const apiToken = env('API_TOKEN');
const workerSecret = env('RENDERER_SHARED_SECRET');
const supabaseUrl = env('SUPABASE_URL');
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
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
        'x-github-api-version': '2026-03-10',
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
if (supabaseUrl && serviceKey) supabase = createClient(supabaseUrl, serviceKey, {auth:{persistSession:false,autoRefreshToken:false}});

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

app.get('/health', async () => ({ok:true,service:'film-studio-api',databaseConfigured:Boolean(supabase)}));

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
app.listen({host:'0.0.0.0',port}).catch((error) => {app.log.error(error);process.exit(1);});
