# ChatGPT Film Studio

Free-tier-first, ChatGPT-directed film production. ChatGPT is the creative director; Lemo-Opuscar guides film methodology and style; Remotion renders code-driven scenes; FFmpeg processes media; Supabase stores jobs and private outputs.

## Boundaries
- No Gemini or paid API dependency.
- Remotion composes supplied assets, graphics, typography, procedural animation and audio; it is not a text-to-video model.
- Render target begins with 5-second 720p smoke tests, then multi-scene, audio, subtitles and vertical output.
- Supabase Storage stays private. Service-role keys remain server-side.
- Render local disk is ephemeral; upload before marking a job complete.
- Existing Cloudflare, Supabase and Render resources are not modified until confirmed suitable.

## Local development
Requires Node.js 22+, FFmpeg and Remotion-compatible Chromium libraries.
1. Copy `.env.example` to `.env` and configure secrets.
2. `npm install`
3. `npm run typecheck && npm test`
4. `npm run dev:api`
5. `npm run render:smoke`

See `docs/ARCHITECTURE.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/DEPLOYMENT.md` and `docs/IMPLEMENTATION_STATUS.md`.

Status: scaffold committed; dependency install, live deployment and real MP4 end-to-end acceptance remain unverified.