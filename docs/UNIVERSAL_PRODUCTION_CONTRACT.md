# Universal Production Contract

The canonical runtime contract is `ProductionSpecSchema` in `packages/contracts/src/index.ts`. Every intake/planning provider must normalize into this schema; renderers consume validated manifests and must not add story-specific schema branches.

## Contract boundaries

- **Project and output:** `schemaVersion`, title, idea, style ID/invariants, duration, aspect ratio, dimensions and FPS.
- **Characters and reusable assets:** stable character IDs, rig/appearance/animation maps, asset IDs/types, immutable library key/version pairs, asset metadata and required flags.
- **Environments and props:** environment identity, reusable environment asset, geography/atmosphere, lighting, props and continuity notes.
- **Scenes and shots:** ordered scenes, scene duration, optional explicit start/end window, environment reference, actors/actions, props, camera keyframes, lighting, shot timing, referenced assets and transitions.
- **Performance and camera:** actor action types, bounded action timing, target positions/rotations, camera keyframes and chronological validation.
- **Audio and dialogue:** voice profiles, dialogue lines, audio cues, asset type compatibility, cue timing, fades and gain bounds.
- **Captions:** scene-linked caption cues and legacy subtitle cues; both are checked against the production runtime.
- **Delivery and QA:** output profiles, platform metadata, enabled QA rules and component version manifest.

## Timeline rules

Scene array order is canonical. Scene durations must sum to the production duration within one second. When explicit scene `startSeconds` and `endSeconds` are supplied, both are required, the window must equal `durationSeconds`, and windows must be contiguous in scene-array order. Dialogue timecodes are absolute production timecodes and must fall inside their referenced scene window. Shots, audio cues, captions and subtitles must stay inside the production runtime.

## Identity and references

IDs are unique within their collection. References must resolve to declared entities: scene-to-environment, actor-to-character, character-to-rig, shot/audio-to-asset, dialogue-to-character/voice, and prop-to-asset. Reusable library assets use the pair `libraryAssetKey` + `libraryVersion`; a partial pair is invalid. Asset content is immutable by version; updates should register a new version rather than mutate an existing version in place.

## Version compatibility

- `schemaVersion: 1 | 2` identifies the manifest format.
- `migrateProductionSpec` validates v1 input and upgrades it additively to v2, retaining scene content and materializing project metadata defaults.
- `versionManifest`, when present, records the schema, renderer, asset, production-plan, audio and render-settings component versions.
- Version 1 jobs remain readable; optional v2 additions must not make existing queued manifests invalid. Do not reinterpret an old job using the latest asset or renderer defaults.

## Validation and tests

Validation runs before a job is queued for expensive rendering. It rejects invalid runtime/dimensions, duplicate IDs, dangling references, unsupported action types, invalid camera ordering, out-of-range actions/timecodes, incompatible audio asset types, incomplete immutable asset references and incomplete version manifests.

Run from the repository root:

```bash
npm run build
npm run typecheck
npm test
```

The contract test suite includes both the original shadow-story fixture and a materially unrelated museum-clock story. The second story must validate using the same schema and without renderer source changes.
