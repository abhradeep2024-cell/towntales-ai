# Real Factory implementation roadmap

**Purpose:** Build a reusable automated animation studio. A new story must be represented by production data, not new story-specific renderer code.

**Creative benchmark:** TownTales Episode 01 production Bible. It is a benchmark and sample input, not a hardcoded renderer specification.

## Delivery gates

A task is complete only when its implementation, automated tests, and relevant runtime evidence pass. A successful TypeScript build alone does not prove creative quality. Keep the implementation pull request in draft until the critical gates below pass.

## Ordered implementation tasks

1. **Baseline audit and CI repair**
   - Audit the current repository, workflows, dependencies, API, renderer, database contract, storage and existing production pipeline.
   - Fix all build, type, test, security and smoke-render failures before expanding the engine.
   - Record known gaps and evidence.

2. **Universal production contract**
   - Define a versioned, provider-neutral production manifest for project metadata, creative constraints, output profiles, characters, reusable assets, environments, scenes, shots, camera tracks, actor tracks, props, dialogue, narration, music, sound effects, subtitles, transitions and QA rules.
   - Support per-project frame rate, resolution, aspect ratio and duration rather than hardcoding Episode 01 values.
   - Validate references, timelines, asset IDs, timing overlaps, required fields, supported actions and schema migrations.

3. **Story and Bible intake**
   - Accept plain text and supported document formats (initially DOCX, TXT and JSON; add PDF only with reliable extraction).
   - Preserve source text and source references.
   - Extract creative rules, story beats, characters, locations, scenes, shots, dialogue, audio cues and delivery requirements.
   - Report ambiguity and missing information instead of silently inventing critical facts.

4. **Story understanding and production planning**
   - Convert arbitrary input into a normalized brief, script and shot-by-shot plan.
   - Maintain narrative causality, character identity, location continuity, scene chronology and target runtime.
   - Produce structured production data that conforms to the universal contract.
   - Add human-review checkpoints only for genuinely ambiguous or high-impact creative decisions; routine production should proceed automatically.

5. **Reusable asset and continuity library**
   - Implement versioned character, rig, environment, prop, material, lighting, animation, typography and audio assets.
   - Resolve every asset reference before rendering.
   - Reuse approved assets and retain identity/appearance continuity across scenes and episodes.

6. **Character and rig system**
   - Replace placeholder-only primitive figures with reusable production rigs.
   - Support configurable body proportions, clothing, hair, face, materials, shadows and accessories.
   - Add locomotion, gestures, poses, gaze, facial expressions, reactions, interactions and retargetable animation clips.
   - Validate foot contact, joint limits, clipping and pose transitions.

7. **Environment and prop system**
   - Provide reusable indoor/outdoor environment layouts, geography, set dressing, props and collision/interaction anchors.
   - Support lighting presets, time of day, atmosphere, weather and environmental motion.
   - Preserve spatial continuity and deterministic scene layout.

8. **Animation, choreography and camera engine**
   - Implement timeline-driven actor animation, path movement, interaction, blocking, choreography and state transitions.
   - Implement camera framing, lens/FOV, tracking, pans, tilts, push-ins, focus targets and keyframe interpolation.
   - Support transitions, particles and visual effects.
   - Ensure action tracks compose predictably when actions overlap.

9. **Narration and dialogue**
   - Generate or ingest voice tracks with configurable provider/voice settings.
   - Preserve pronunciation, pacing, pauses and character voice identity.
   - Align words from final generated audio, not estimated script timings.
   - Synchronize dialogue with character performance.

10. **Music and sound design**
    - Resolve or generate licensed/original music, ambience, Foley and effects.
    - Support timed cues, ducking, fades, mixing and silence.
    - Detect missing tracks, clipping, excessive peaks, unintended silence and narration masking.

11. **Captions and graphic composition**
    - Generate word-synchronized captions from final audio alignment.
    - Support per-style typography, emphasis, animation, safe areas and face/clue avoidance.
    - Add title cards, labels and other overlays without obscuring story information.

12. **Preview-first rendering**
    - Render individual shots/scenes at review resolution.
    - Generate contact sheets and scene metadata.
    - Allow selective preview and deterministic rerendering.
    - Do not render a full master before the preview passes.

13. **Automated technical QA**
    - Validate codecs, dimensions, aspect ratio, FPS, duration, frame count, audio streams, full decode, black/frozen frames, missing media and output integrity.
    - Validate asset references, scene timeline reconciliation, subtitle bounds and audio/video synchronization.

14. **Automated creative QA**
    - Evaluate hook, narrative clarity, continuity, visual readability, animation quality, shot purpose, character consistency, caption readability, sound mix and ending/payoff.
    - Use deterministic checks where possible and model-based review with evidence for subjective criteria.
    - Produce issue reports with scene/timecode and severity.

15. **Repair and selective rerender**
    - Convert QA findings into bounded repair tasks.
    - Repair only affected production data/assets/shots.
    - Rerender impacted shots and re-run dependent QA.
    - Enforce retry budgets and stop conditions to prevent infinite loops.

16. **Final assembly and delivery**
    - Assemble approved shots, narration, dialogue, music, effects and captions.
    - Export MP4/H.264/AAC profiles and retain source/intermediate assets.
    - Verify final media and create a production report with manifest, asset versions, render settings and QA evidence.

17. **Orchestration and persistence**
    - Implement explicit durable job states, idempotency, stage-level retries, cancellation, recovery and progress reporting.
    - Persist production manifests, scene records, asset metadata, logs and outputs in Supabase.
    - Use private storage and signed access for media.
    - Keep GitHub Actions as the workflow/render execution layer and Render as the API/backend role unless verified architecture changes are needed.

18. **End-to-end automation**
    - Implement: upload → parse → interpret → plan → validate → resolve/generate assets → audio → preview → QA → repair → final render → storage → report.
    - Ensure routine runs do not require manual assembly.
    - Integrate Agent-Reach/REA only where their actual capabilities and interfaces materially improve this workflow; do not add dependencies without verified value.

19. **Episode 01 benchmark acceptance**
    - Convert Episode 01 into production data using the same generic schema.
    - Verify all Bible requirements against actual rendered output.
    - Record technical and creative QA evidence and close all critical defects.

20. **Second-story generalization test**
    - Supply a materially different story/Bible.
    - Run it through the same pipeline without changing story-specific renderer code.
    - Confirm the system adapts through production data and reusable assets.

21. **Reliability, security and performance**
    - Test malformed inputs, missing assets, provider outages, interrupted jobs, duplicate requests, concurrent jobs, storage failures, retries and recovery.
    - Verify secrets are never exposed, internal tables remain protected and storage remains private.
    - Measure render time, memory, queue latency and failure rates.

22. **Final acceptance**
    - All critical automated tests pass.
    - Episode 01 and the independent second story pass technical and creative acceptance.
    - Final MP4s are independently decoded and retrieved from Supabase.
    - Production reports and recovery evidence are available.
    - Only then mark the reusable engine production-ready.

## Non-negotiable architecture rule

The renderer must be generic. Story-specific details belong in validated production manifests and reusable assets. A new story must not require editing renderer source code.

## Current baseline note

The initial declarative scene foundation exists on the remediation branch, but it is not yet a complete production engine. The first known CI build failure was a Zod default-type mismatch in `CharacterAppearanceSchema`; the fix is being validated. A malformed escaped newline in the declarative smoke composition was also corrected. Neither fix is considered verified until the latest CI run passes.
