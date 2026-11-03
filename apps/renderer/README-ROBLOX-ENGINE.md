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
- The private `towntales-assets` bucket must allow `video/mp4` and `application/json` (50 MB per-object limit); CI verifies both content types with signed-download byte comparisons.
- Sidecar delivery for the production manifest, word alignments, technical QA and pending creative review.

## Reusable declarative animation engine

The core renderer must be story-agnostic. Episode-specific story logic belongs in input production data, never in the shared renderer.

Structured production specifications can now define:

- A reusable character library with stable character IDs, block-humanoid rig selection and per-character appearance.
- Per-scene actor instances referencing those character IDs.
- Time-based actor actions: idle, walk, run, wave, point, turn, jump, recoil, gesture, move, disappear and appear.
- Independent actors in the same scene, allowing a character and a separately animated shadow/double to move on different timelines.
- Environment props (box, sphere, cylinder and plane) with transforms and materials.
- Camera keyframes with position, target and field-of-view interpolation.
- Scene lighting and background settings.
- Scene-level action timing independent of narration, with word alignment available to coordinate cues.

Example production data shape:

```json
{
  "characters": [
    {
      "id": "CHAR_ALEX_001",
      "name": "Alex",
      "rig": "block-humanoid",
      "appearance": {
        "bodyColor": "#2369a8",
        "skinColor": "#e9b58d",
        "hairColor": "#101116",
        "pantsColor": "#11151e",
        "shoeColor": "#f1f2f4",
        "scale": 1
      }
    }
  ],
  "scenes": [
    {
      "id": "scene-01",
      "title": "The reveal",
      "durationSeconds": 6,
      "visualDirection": "A character reacts as a second actor waves independently.",
      "narration": "",
      "actors": [
        {
          "characterId": "CHAR_ALEX_001",
          "position": [0, 0, 0],
          "actions": [
            { "type": "idle", "startSeconds": 0, "durationSeconds": 6 },
            { "type": "turn", "startSeconds": 2, "durationSeconds": 0.6, "targetRotationY": 1.2 }
          ]
        }
      ],
      "props": [],
      "camera": {
        "keyframes": [
          { "atSeconds": 0, "position": [0, 3, 9], "target": [0, 1, 0], "fov": 40 },
          { "atSeconds": 6, "position": [1, 2, 6], "target": [0, 1, 0], "fov": 32 }
        ]
      }
    }
  ]
}
```

The declarative runtime is selected whenever a scene contains structured actors, props or camera keyframes. The original Episode 01 composition remains a legacy reference implementation until its full storyboard is migrated to the generic scene/action format.

CI includes a dedicated declarative renderer smoke test so the generic animation path is validated independently of the Episode 01 fixture.

## Remaining production gates

- Characters are still procedural R6-inspired placeholders; approved custom character assets and final facial/rig polish remain outstanding.
- GitHub Actions is configured to render the complete 1080 × 1920, 60-second master, validate all 1,800 frames and enforce the 50 MB private-storage limit. The production worker applies the same checks before upload.
- The CI contact sheet enables visual review, but final playback and listening review are still required to certify continuity, animation, sound design and story comprehension.

All scene animation remains frame-driven and deterministic. A successful render alone is not a release approval.
