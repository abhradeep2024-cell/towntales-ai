# TownTales 3D Story Renderer

The former text-card presentation is replaced with a deterministic Three.js scene rendered through React Three Fiber inside Remotion.

## Implemented
- Procedural, block-proportioned R6-inspired Alex character with reusable proportions and materials.
- Independently positioned Shadow Alex counterpart with dark silhouette and glowing eyes.
- Deterministic frame-based idle and walk cycles.
- Bedroom set dressing for bedroom, morning, sleep, wake and room scene directions.
- Cinematic lighting, fog, atmospheric particles and scene-specific backgrounds.
- Word-by-word karaoke-style subtitle emphasis across each existing subtitle cue.
- Existing narration/music muxing, Supabase queue, upload verification and worker path retained.

## Not yet production-complete
- Characters are procedural placeholders, not final custom-sculpted assets or licensed Roblox avatar exports.
- Scene blocking is heuristic; exact shot list, camera moves, props, Shadow Alex independent choreography and bedroom double still need to be authored from the Episode 01 Bible.
- Word highlighting is evenly distributed within each subtitle cue. It is not forced alignment against actual speech audio. True word timestamps must be generated or supplied.
- Chromium WebGL compatibility must pass the GitHub Actions smoke render before deployment.
- A real Episode 01 job must be rendered, visually reviewed, downloaded and validated before production readiness.

All animation is driven by Remotion frame values for deterministic rendering.
