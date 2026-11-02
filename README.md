# ChatGPT Film Studio

Free-tier-first, ChatGPT-directed film production. ChatGPT is the creative director; Lemo-Opuscar provides the 66-style directing library and frame-renderer contract; Remotion renders structured scenes; FFmpeg performs audio/video mastering; Supabase stores jobs and private MP4s.

## Production modes
- **Lemo project page:** submit projectFiles containing index.html and local JS/CSS/JSON/SVG assets. The page must expose window.DUR, deterministic window.render(t), and window.READY. The Lemo-Opuscar headless renderer renders it against the pinned Lemo library, including shared core helpers and the styles tree.
- **Remotion scene fallback:** omit projectFiles and submit a validated multi-scene script. Supports title/scene animation, subtitles, landscape, portrait and square dimensions.
- **Audio:** optional Edge TTS narration per scene, local espeak-ng fallback, original procedural ambient music, FFmpeg mixing and loudness normalization. The Edge voice service requires network access; espeak-ng is local.

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

Status: the earlier five-second Remotion render is verified. Multi-scene, vertical, voice/music, Lemo page rendering, live database access and GPT Action end-to-end runs are pending CI and deployment checks.
