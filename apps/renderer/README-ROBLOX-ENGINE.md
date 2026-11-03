# TownTales 3D Story Renderer

The former text-card presentation is replaced with deterministic Three.js scenes rendered through React Three Fiber inside Remotion.

## Implemented

- Reusable R6-inspired Alex and Shadow Alex procedural character rigs with persistent wardrobe and materials.
- Scene-driven shadow choreography: delayed independent movement, three-wave gesture, head turn, chase movement, shadowless double and daylight missing-shadow reveal.
- Animated bedroom door, bedroom-double entrance, Alex recoil, blackout and brief glowing-eye reveal; the town front door opens and slams as Alex reaches home.
- Final over-the-shoulder window shot with the original shadow behind the glass, Bible on-screen text overlays and a hard cut to black.
- Scene-specific camera movement, legible 9 PM clock insert, town/bedroom environments and day/night lighting.
- Edge TTS word-boundary extraction, serialized narration scheduling and strict word-timing validation.
- Word-synchronized, two-word kinetic captions burned from actual narration timestamps after audio assembly.
- Original procedural suspense effects: opening boom, wind, clock ticks, chase footsteps, door creak, heartbeat, electrical buzz, morning birds and final impact.
- Production worker checks for H.264/AAC, target dimensions, frame rate, decoded frame count, file size and full decode.
- Private Supabase upload verification with byte-for-byte signed-download checks.
- Sidecar delivery for the production manifest, word alignments, technical QA and pending creative review.

## Remaining production gates

- Characters are still procedural R6-inspired placeholders; approved custom character assets and final facial/rig polish remain outstanding.
- GitHub Actions is configured to render the complete 1080 × 1920, 60-second master, validate all 1,800 frames and enforce the 50 MB private-storage limit. The production worker applies the same checks before upload.
- The CI contact sheet enables visual review, but final playback and listening review are still required to certify continuity, animation, sound design and story comprehension.

All scene animation remains frame-driven and deterministic. A successful render alone is not a release approval.
