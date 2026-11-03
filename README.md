# Real Factory

Real Factory is an automated animation production pipeline, not a SaaS product. It accepts a story/script/production Bible, plans scenes and assets, renders previews and masters, performs technical QA, and stores outputs privately. ChatGPT is the creative director; Lemo-Opuscar provides the 66-style directing library and frame-renderer contract; Remotion renders structured scenes; FFmpeg performs audio/video mastering; Supabase stores jobs and private MP4s.

## Production modes
- **Lemo project page:** submit projectFiles containing index.html and local JS/CSS/JSON/SVG assets. The page must expose window.DUR, deterministic window.render(t), and window.READY. The Lemo-Opuscar headless renderer renders it against the pinned Lemo library, including shared core helpers and the styles tree.
- **Remotion scene fallback:** omit projectFiles and submit a validated multi-scene script. Supports title/scene animation, subtitles, landscape, portrait and square dimensions.
- **Audio:** optional Edge TTS narration per scene, local espeak-ng fallback, original procedural ambient music, FFmpeg mixing and loudness normalization. The Edge voice service requires network access; espeak-ng is local.

## Submit a production
From the repository root, set your API token and submit a DOCX, TXT or JSON brief:
```bash
cd apps/api
API_TOKEN="YOUR_API_TOKEN" npm run submit -- ../path/to/story.docx --title "My story" --aspect-ratio 9:16 --style roblox-cinematic
```
Optional flags: `--description "..."`, `--style <style-id>`, `--aspect-ratio 16:9|9:16|1:1`, and `--no-wait` (return after queueing instead of waiting). By default the command waits for rendering and creative QA, then prints the approved MP4 URL and signed QA/preview artifact URLs. A creative-QA rejection returns the review findings and a non-zero exit code. Set `API_BASE_URL` if the API is not hosted at the default Render URL. Keep `API_TOKEN` private; never put it in source control.

Story planning requires `AI_API_KEY` and `AI_MODEL`. Automated creative QA requires a vision-capable model configured as `CREATIVE_QA_MODEL` (or a vision-capable `AI_MODEL`). Set `AI_BASE_URL` when using an OpenAI-compatible provider other than the default.

## Free-tier architecture
- Render free web service hosts only the authenticated API.
- Public GitHub Actions standard runners render videos and are free for public repositories. Render's free API instance sleeps after 15 minutes without inbound traffic.
- Supabase free project stores job state and the existing private towntales-assets MP4 bucket.
- No Gemini, paid media API, or paid compute plan is required.
- Never place credentials in source code, project page files or browser-side data.

## Local development
Requires Node.js 22+, FFmpeg, Python 3.11+, and browser support.
1. git submodule update --init --recursive
2. npm install
3. npm --prefix vendor/lemo-opuscar install
4. node vendor/lemo-opuscar/node_modules/playwright-core/cli.js install chromium-headless-shell
5. python3 -m venv .venv && .venv/bin/pip install edge-tts
6. Copy .env.example to .env and set secrets.
7. npm run build && npm run typecheck && npm test
8. Run the landscape, multi-scene, vertical and Lemo smoke scripts.

See docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/LEMO_INTEGRATION.md, docs/CHATGPT_ACTIONS_SETUP.md, docs/DEPLOYMENT.md and docs/IMPLEMENTATION_STATUS.md.

## Verification status (2026-11-03)
- Latest recorded Film Studio CI run passed build, type checks, unit tests and the six render smoke outputs (landscape, audio/voice, multi-scene, vertical, Lemo page and Art Deco engine).
- Render API deployment is live and its root endpoint responds HTTP 200.
- Supabase authentication after the owner's latest secret-key replacement has not yet been verified by a fresh database health request. Do not treat a live Render deployment or a passing render-only CI run as proof of database connectivity.
- A production job has not yet been verified end to end through queue claim, rendering, private bucket upload, QC, signed URL generation and playback.
- GPT Action configuration and authenticated Action calls still require owner-side setup and testing.

## Known limits
- A Lemo style still requires ChatGPT to generate a film-specific Lemo page using the selected style guide and engine source. The repository does not contain 66 prebuilt job-specific templates.
- Procedural music is a basic original pad; sophisticated sampled scores, action-timed foley, Whisper transcript validation and iterative auto-QC remain future work.
- A successful CI artifact is not the same as a verified Supabase output URL from a live Render job.
