# Lemo-Opuscar integration

## Source and pin
- Source: https://github.com/abhradeep2024-cell/lemo-opuscar
- Licence: MIT (retain its upstream LICENSE notice for copied or distributed portions).
- Submodule target: `vendor/lemo-opuscar`.
- Initial pin: `bebbbe1aa92a3cb4bb6f83500e61b23a17d1aa00` (31 October 2026).
- Never edit the upstream or submodule contents as part of an individual film.

## Role in Film Studio
Lemo-Opuscar is the creative/directing framework and visual-style library. It is not the production API, the renderer, or a generative-video model. ChatGPT applies the framework while creating the production specification; Remotion renders that specification.

## Required director workflow
1. Read the user's own styles first, then resolve the requested style via `styles/README.md`.
2. Read the selected `styles/<slug>/STYLE.md` fully and preserve its invariants.
3. Before opening that style's demo, create the film's own treatment with three candidate narrative structures and a selected structure (unless the style's material-gathering exception applies).
4. Build the film's own script, shot list, second-by-second beat sheet, cue map, sound-design table, and continuity instructions. Do not reuse the demo's story, shots, props or timeline.
5. Prove the look with actual style frames; if a storyboard was requested, pause for approval at that point.
6. Produce, mix and review; perform one consolidated correction round.
7. Before delivery, inspect a contact sheet, key-action frame strips and the film at full speed with sound.

Directing priorities are sound, rhythm, camera and performance/staging/emotional arc. A visually attractive still is not sufficient.

## Mapping to production data
- `styleId`: exact Lemo style folder slug.
- `styleInvariants`: concise, explicit invariant list extracted from that style's STYLE.md.
- `scenes[].visualDirection`: scene-level staging, framing, camera movement, composition and motion instructions.
- `scenes[].narration` and `subtitles`: voice/subtitle timing and text.
- `audio`: references to licensed/user-provided score and voice assets (asset registry is a later implementation phase).

## Current implementation gap
The current API validates a style ID and invariant list, and the director workflow is documented here. The first Remotion renderer is still a generic typography/motion composition. It does not yet implement all 66 visual engines from Lemo, music/foley production, TTS, or the full Lemo review suite. Those are explicit follow-on tasks, not features to claim as complete.

## Checkout
After cloning:
```bash
git submodule update --init --recursive
```

The CI workflow checks the Film Studio app itself; Lemo's own optional dependencies are not installed as part of the initial API/renderer build.
