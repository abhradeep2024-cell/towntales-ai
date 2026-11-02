# Deployment

## Render API
Use the Animation workspace and deploy the Dockerfile as a single free Web Service. It only hosts the Fastify API; do not run Chromium on Render's free 0.1 CPU / 512 MB instance. Free services sleep after 15 minutes of no inbound traffic, so expect cold starts. The filesystem is ephemeral.

## GitHub Actions renderer
The repository is public so standard GitHub-hosted Actions runners can execute the Remotion/Chromium render workload without consuming paid minutes. The renderer workflow is manually dispatched by the API when `GITHUB_ACTIONS_TOKEN` is configured; otherwise it polls the queue every five minutes. Add the repository Actions secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `API_BASE_URL`, and `RENDERER_SHARED_SECRET`. For immediate dispatch, set a fine-grained GitHub token with only Actions:write as the Render API service's `GITHUB_ACTIONS_TOKEN` environment variable. The scheduled fallback does not require that token.

## Supabase
Use a dedicated project or an explicitly approved existing project. Create a private `film-studio-private` bucket with upload limits. Apply migrations only after project identity and quota verification. Never expose the service-role key.

## ChatGPT integration
Expose authenticated OpenAPI-compatible operations for job creation, status, cancellation and signed output retrieval. Keep API and worker tokens distinct.

## Free-tier guardrails
Verify provider limits and plan status before provisioning. No paid upgrade or paid API without explicit approval. The renderer image requires Node 22, Chromium and FFmpeg.
