# Deployment

## Render
Use the Animation workspace. Deploy API and renderer as separate Docker services from this repository. Start with one worker and low-resolution short renders. Free services may sleep; local disk is ephemeral.

## Supabase
Use a dedicated project or an explicitly approved existing project. Create a private `film-studio-private` bucket with upload limits. Apply migrations only after project identity and quota verification. Never expose the service-role key.

## ChatGPT integration
Expose authenticated OpenAPI-compatible operations for job creation, status, cancellation and signed output retrieval. Keep API and worker tokens distinct.

## Free-tier guardrails
Verify provider limits and plan status before provisioning. No paid upgrade or paid API without explicit approval. The renderer image requires Node 22, Chromium and FFmpeg.
