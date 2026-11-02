# Lemo-Opuscar integration

## Source and pin
- Source: https://github.com/lemomo-ai/lemo-opuscar
- Licence: MIT; retain the upstream LICENSE when distributing copied or modified portions.
- Submodule: vendor/lemo-opuscar.
- Pinned commit: bebbbe1aa92a3cb4bb6f83500e61b23a17d1aa00 (31 October 2026).
- Do not modify the upstream submodule for an individual film.

## What is integrated
The API exposes the pinned 66-style catalog at GET /v1/styles, a selected STYLE.md at GET /v1/styles/{slug}, and a pinned source index at GET /v1/styles/{slug}/engine. Request the exact source module with the file query parameter. Each production may submit projectFiles with a complete film page. The renderer writes these text assets to an isolated temporary folder and invokes Lemo's own core/render/video.mjs headless-browser renderer. This uses the shared Lemo core toolkit and page contract rather than imitating its output with a universal Remotion template.

A Lemo page must:
- Define positive window.DUR in seconds, equal to the production's target runtime.
- Expose deterministic window.render(t) and draw a complete frame for any timestamp.
- Set window.READY = true only once images and fonts are ready.
- Load local assets only. Do not reference external scripts, network-hosted fonts, remote media, or secrets.
- Use absolute library paths such as /core/lib.js and /styles/<slug>/demo/engine/... when a pinned shared/style engine module is required.

The project file bundle accepts at most 40 UTF-8 text files (HTML, JS/MJS, CSS, JSON, SVG, TXT, SRT or XML), at most 1.8 MB total. Binary media should be supplied as optimized data URIs or integrated through an approved asset workflow.

## Director workflow
1. Call GET /v1/styles and resolve the exact slug.
2. Call GET /v1/styles/{slug}; read the complete style guide and preserve its invariant look, composition, material, motion, camera and sound vocabulary.
3. Prepare a treatment with three different story structures, choose one, and write a beat sheet, script, shot list, cue map, sound-design map and continuity notes.
4. Generate the film's own page, not a copy of the Lemo demo story or shot route. The selected style's demo may be studied for engine usage only after the treatment exists.
5. Generate style frames using the same page renderer, then render the full timeline. Use storyboard approval only when the user requested a storyboard.
6. Inspect the film at full speed, plus contact sheets and key action strips. Correct and re-render before delivery.

Sound, rhythm, camera grammar and performance/staging matter as much as attractive stills. No generic demo end card or Lemo sign-off is added.

## Audio
Audio is rendered after the picture:
- Scene narration uses Edge TTS when reachable, with local espeak-ng fallback.
- Original procedural pad music is generated locally (ambient, uplifting or suspense).
- FFmpeg mixes the tracks, applies a limiter and targets -14 LUFS. Lemo project pages should render style-specific subtitles themselves. A generic SRT burn-in is opt-in with audio.burnSubtitles=true; Remotion subtitles are part of the composition.
- The fallback voice is functional but less natural than a neural voice. The current original music generator is a restrained harmonic pad, not a full sampled-instrument score or detailed foley engine.

## Remotion fallback
If projectFiles is omitted, the Remotion scene renderer composes the structured scenes and subtitles. This is the reliable fallback for simple typography/motion videos; it does not automatically reproduce all 66 Lemo visual engines.

## Checkout
  git submodule update --init --recursive
  npm --prefix vendor/lemo-opuscar install
  node vendor/lemo-opuscar/node_modules/playwright-core/cli.js install chromium-headless-shell
