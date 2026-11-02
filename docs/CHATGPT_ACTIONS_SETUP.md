# Connect Film Studio to a Custom GPT

The API and OpenAPI schema are in the repository, but a Custom GPT Action must be attached from the ChatGPT GPT editor. This repository cannot edit the user's GPT configuration.

## 1. Verify deployment first
Open:
- API health: https://film-studio-api.onrender.com/health
- OpenAPI schema: https://film-studio-api.onrender.com/openapi.yaml
- Render service: https://dashboard.render.com/web/srv-dbk6117f3r2c738pvj70

The health response should have `ok: true` and `databaseConfigured: true`. A sleeping free Render service may take time to wake. Do not proceed until the schema returns valid YAML and the service reports the database configured.

## 2. Use a dedicated API bearer key
The API expects an `API_TOKEN` environment variable. Never put this token in GitHub files, prompts, projectFiles, or client-side code.

1. Generate a new random secret locally (for example, `openssl rand -hex 32`).
2. Set it as `API_TOKEN` in the Render service environment.
3. Keep the same value in a password manager so it can be entered into the GPT editor.
4. Also set `SUPABASE_SERVICE_ROLE_KEY` in Render. The API needs this server-side key to access Film Studio tables and create signed output links.

Rotating `API_TOKEN` invalidates previously configured GPT Actions until their authentication value is updated.

## 3. Add the Action to a Custom GPT
1. Open ChatGPT → Explore GPTs → Create (or open an existing GPT you own).
2. In Configure, open Actions → Create new action.
3. Import the schema from `https://film-studio-api.onrender.com/openapi.yaml`.
4. Set Authentication to **API Key**, select **Bearer**, and paste the dedicated `API_TOKEN`.
5. Save the action and run its test on `GET /health`, then `GET /v1/styles?q=art deco`.

Actions are part of Custom GPT configuration. They are not automatically attached to the standard ChatGPT conversation or this repository.

## 4. Suggested GPT instructions
Paste the following into the Custom GPT's Instructions field (adjust the voice/language defaults as desired):

```text
You are Film Studio's creative director and production orchestrator.

For every film:
1. Ask at most one consolidated question round if an essential production decision is missing; otherwise use sensible defaults.
2. Resolve a visual style by calling listFilmStyles. Fetch the exact style guide with getFilmStyleGuide and preserve its invariants. Call getFilmStyleEngine without a file to discover the pinned source modules, then request the exact engine files needed (for example engine/deco.js). Treat bootstrap/demo-reference files as technical references only; never reuse their story, shot sequence, dialogue, timeline or end card. Never copy the example demo's story, shot route, music, props, or end card.
3. Prepare a treatment: logline, three distinct story structures, selected structure and rationale, opening hook, emotional arc, signature native move, ending, scene/shot list, beat sheet, camera grammar, continuity, sound-design map and subtitles.
4. Build a production specification with 1–90 seconds, matching scene durations, requested aspect ratio (16:9, 9:16 or 1:1), fps, soundtrack controls, and the selected style slug.
5. For style-faithful output, provide projectFiles containing index.html and local text assets. index.html must implement deterministic window.render(t), positive window.DUR, and window.READY. Reference the pinned Lemo library with absolute paths such as /core/... or /styles/<slug>/... only. Do not use remote scripts, remote media, external fonts, or secrets. Keep projectFiles under 40 files and 1.8 MB.
6. If a self-contained Lemo project page is not appropriate, omit projectFiles and use the validated Remotion scenes/subtitles fallback. Be clear that Remotion does not create photorealistic footage.
7. Call createRenderJob. Record the returned job id. Poll getRenderJob until completed or failed. On failed jobs, inspect the error and call retryRenderJob only when the cause has been corrected.
8. When completed, call getRenderOutput and provide the signed MP4 URL immediately; it expires after five minutes.
9. Never state a render is complete until the job is completed, QC passed, and the signed MP4 is playable. Describe any limits or failed checks honestly.
10. Do not expose API credentials or attempt to put them in projectFiles.
```

## 5. GitHub Actions worker secrets
In GitHub → Settings → Secrets and variables → Actions, configure:
- `SUPABASE_URL`: `https://hnjcayazxsrmercryztr.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: the Supabase secret key, stored only as an Actions secret
- `API_BASE_URL`: `https://film-studio-api.onrender.com`
- `RENDERER_SHARED_SECRET`: the same value set in Render as `RENDERER_SHARED_SECRET`

The scheduled worker runs every five minutes. For immediate dispatch, optionally configure a fine-grained GitHub token with only Actions:write on this repository as Render's `GITHUB_ACTIONS_TOKEN`. This token also remains server-side.

## 6. Troubleshooting
- `databaseConfigured: false`: set Render's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `renderDispatch: scheduled_fallback`: this is expected without `GITHUB_ACTIONS_TOKEN`; the queue is polled every five minutes.
- Job stays queued: verify all four repository Action secrets and check the Film Studio Renderer workflow run.
- Lemo project fails to load a module: use absolute Lemo library paths and ensure the required style engine is available in the pinned submodule. Keep scripts/fonts/assets local.
- MP4 exceeds 50 MB: shorten the film, lower output resolution, simplify visuals, or use a lighter codec/CRF before upload.
- Signed URL fails: check that the existing `towntales-assets` bucket is still private and that Render's service-role key is correct.
