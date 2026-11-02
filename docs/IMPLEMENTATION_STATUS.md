# Implementation status

## Implemented in source
- Authenticated Fastify API for create/status/retry/cancel/output.
- Action schema served at /openapi.yaml; style catalog and style-guide API endpoints.
- Zod production specification with landscape, portrait, square, scene timing and safe Lemo project-page validation.
- Pinned Lemo-Opuscar submodule and a worker path that renders supplied Lemo page projects through Lemo's native headless renderer.
- Remotion structured multi-scene fallback, including subtitles and 9:16 composition.
- Audio pipeline with Edge TTS, local espeak-ng fallback, original procedural music, FFmpeg mixing and subtitle burn-in for Lemo pages.
- Supabase migrations for jobs/logs, projects/assets and bounded retries; existing private MP4 bucket reused.
- GitHub Actions CI now tests build, types, unit tests, Remotion landscape, multi-scene, vertical, audio mux and Lemo page rendering.
- Public-repository GitHub Actions worker uses standard hosted runners; Render free instance hosts the API only.
- Gitleaks full-history secret scanning is included in CI; credentials are supplied only through GitHub Actions secrets or server-side environment variables.

## Verified so far
- Earlier five-second Remotion smoke render passed, was decoded with FFmpeg, metadata checked with ffprobe, uploaded as an artifact and visually sampled.
- API Docker service was created and a deployment was previously marked live.
- Two Supabase migrations were applied and the four Film Studio tables are present with RLS enabled.

## Pending verification after the current commits
- Latest CI build and the new audio/multi-scene/portrait/Lemo integration suite.
- Original Art Deco style-engine page is included in CI. The first run exposed and fixed a fixture typo; the corrected native engine render is pending CI confirmation. The other 65 styles still need representative rendering tests.
- Edge TTS voice network call and espeak fallback in CI.
- Full end-to-end job through the deployed API, worker, private bucket upload, signed URL and final MP4 inspection.
- Render API's Supabase backend key and GitHub Actions deployment secrets must be configured by the owner. `SUPABASE_SECRET_KEY` is preferred; the matching legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported.
- GPT Action must be added manually in the GPT editor and tested with the owner-managed bearer API key.

## Limitations to keep explicit
- A Lemo style still requires ChatGPT to generate a film-specific Lemo page using the selected style guide and engine source. The repository does not contain 66 prebuilt job-specific templates.
- Procedural music is a basic original pad; sophisticated sampled scores, action-timed foley, Whisper transcript validation and iterative auto-QC remain future work.
- A successful CI artifact is not the same as a verified Supabase output URL from a live Render job.
