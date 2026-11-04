# Deployment

## Render API
Use the Animation workspace and deploy the Dockerfile as a single free Web Service. It only hosts the Fastify API; do not run Chromium on Render's free 0.1 CPU / 512 MB instance. Free services sleep after 15 minutes of no inbound traffic, so expect cold starts. The filesystem is ephemeral.

## GitHub Actions renderer
The repository is public so standard GitHub-hosted Actions runners can execute the Remotion/Chromium render workload without consuming paid minutes. The renderer workflow is manually dispatched by the API when GITHUB_ACTIONS_TOKEN is configured; otherwise it polls the queue every five minutes. Its job installs FFmpeg, espeak-ng, Edge TTS and the pinned Lemo-Opuscar renderer. Add the repository Actions secrets `SUPABASE_URL`, `API_BASE_URL`, and `RENDERER_SHARED_SECRET`, plus either `SUPABASE_SECRET_KEY` (preferred current `sb_secret_…`) or the matching legacy `SUPABASE_SERVICE_ROLE_KEY`. Never store both in source. For immediate dispatch, set a fine-grained GitHub token with only Actions:write as the Render API service's `GITHUB_ACTIONS_TOKEN` environment variable. The scheduled fallback does not require that token.

## Supabase
Use a dedicated project or an explicitly approved existing project. Create a private `towntales-assets` bucket with upload limits. Apply migrations only after project identity and quota verification. Never expose the secret key or legacy service-role key. Apply the ordered SQL migrations, including `202611040001_asset_library.sql`, before using project intake or the reusable asset library.

## Story planning provider
The API's story planner uses an OpenAI-compatible Chat Completions endpoint. Configure `AI_MODEL` and one of `AI_API_KEY`, `OPENAI_API_KEY`, or `OPENROUTER_API_KEY` in the Render API environment. Set `AI_BASE_URL` when using a provider other than the matching OpenAI/OpenRouter defaults. The planner fails closed when the provider is not configured or returns a manifest that fails the production contract. Do not put provider keys in GitHub Actions or source code; the API makes the planning request.

## ChatGPT integration
Expose authenticated OpenAPI-compatible operations for DOCX/TXT/JSON intake, AI story planning, versioned asset registration/search, job status, cancellation and signed output retrieval. Keep API and worker tokens distinct.

## Free-tier guardrails
Verify provider limits and plan status before provisioning. No paid upgrade or paid API without explicit approval. The renderer image requires Node 22, Chromium and FFmpeg.
