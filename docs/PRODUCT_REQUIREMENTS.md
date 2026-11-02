# ChatGPT Film Studio — Product Requirements

## Goal
A user gives ChatGPT a film idea and receives a technically validated MP4 through a fully directed and automated production workflow. All infrastructure must remain on free plans.

## Required workflow
BRIEF → STYLE → TREATMENT → SCRIPT → SHOT LIST → ASSET PLAN → COMPOSITION → RENDER → QC → DELIVERY

## Functional requirements
1. Brief processing: accept idea, detailed story/script, style reference, duration, aspect ratio and target platform; output audience, objective, tone and delivery spec.
2. Film styles: inspect Lemo-Opuscar styles, recommend/describe a style, preserve its invariants, allow override.
3. Treatment: logline, concept, beginning/middle/end, emotional progression, visual language, sound direction and signature cinematic moment; three story structures where appropriate.
4. Script: scene numbers/descriptions, dialogue/VO/action/transitions, timing and emotional intent.
5. Planning: beat sheet, shot list, timeline, camera movement, composition, lighting, continuity and sound cue map.
6. Assets: generated or supplied images, backgrounds, character images, graphics, text, typography, animation and procedural effects; organized and validated by scene.
7. Composition: multiple scenes, transitions, motion, typography, animated images, audio, subtitles; 16:9, 9:16 and 1:1; target 1080p when resources allow.
8. Audio: voiceover/dialogue/music/SFX, mix and subtitle sync; evaluate free tools such as Kokoro or edge-tts; check clipping.
9. API: authenticated create/status/cancel/output/health endpoints; validate specs; queue, progress, logs, retries and errors.
10. Jobs: id, title, spec, timestamps, state, progress, logs, output location and errors. States: queued, rendering, uploading, completed, failed, cancelled.
11. QC: existence, nonzero bytes, readable metadata, duration tolerance, resolution, FPS, audio/subtitle presence, black/missing-frame checks and full decode.
12. Delivery: persistent private MP4, signed download link, metadata, retained spec and revisions.

## Security and infrastructure constraints
- Separate API and worker credentials; no secrets in clients or prompts.
- Private bucket and short-lived signed URLs.
- Validate file types/size and prevent arbitrary command execution.
- Render free instance only; account for sleep, CPU/RAM and ephemeral disk.
- Supabase quotas and storage restrictions must be verified before use.
- Cloudflare R2 is optional and must not be assumed enabled.
- Never modify upstream Lemo-Opuscar or Remotion repositories.

## Acceptance tests
- API auth rejects unauthorized requests.
- Unit and integration tests cover spec validation, status transitions, Supabase, renderer, FFmpeg, storage and signed retrieval.
- Render 5-second test, 15-second multi-scene, 30-second audio, vertical and subtitle-sync variants.
- Retrieve the MP4, decode it, inspect frames and audio, fix defects and rerender.
- A 2xx response or deployment alone is not success. Completion requires a retrieved, decoded and inspected MP4.

## Definition of success
One creative instruction produces a complete, persistent, validated MP4 through ChatGPT with free-tier services only.
