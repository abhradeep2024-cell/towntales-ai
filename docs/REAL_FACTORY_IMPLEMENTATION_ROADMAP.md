# Real Factory implementation roadmap

**Purpose:** Build a reusable automated animation studio that turns a supplied story or production Bible into a finished, polished animated reel.

**Execution order is mandatory:** Complete and verify the software first. Do not create the Episode 01 example video as a deliverable until the software itself passes the software acceptance gate. Episode 01 is the post-completion demonstration and creative benchmark, not a reason to hardcode story-specific renderer logic.

## Delivery stages

- **Stage A — Build Real Factory:** implement the complete generic software, operator workflow, production pipeline, QA, recovery and documentation. Validate it with automated tests, synthetic fixtures and engine-level smoke tests.
- **Stage B — Prove the finished software:** after Stage A is accepted, run the supplied Episode 01 Bible through the finished software, inspect the actual output against the Bible, fix defects in the generic software, and rerun.
- **Stage C — Generalization:** run a materially different story through the same finished software without story-specific renderer source changes.

## Stage A — Software implementation tasks (complete these first)

1. **Repository and infrastructure baseline**
   - Audit source, dependencies, workflows, Render API, Supabase schema/storage, secrets handling and deployment configuration.
   - Make build, type-check, lint, unit tests, security scans and engine smoke tests deterministic.
   - Establish safe workflow concurrency, timeouts, bounded retries, artifacts and actionable failure logs.
   - Verify Render health checks and API/database integration independently of pull-request-only skipped steps.

2. **Universal production contract**
   - Define a versioned, provider-neutral manifest for project settings, output profiles, story, characters, reusable assets, environments, scenes, shots, camera tracks, actor/action tracks, props, dialogue, narration, music, sound effects, captions, transitions and QA rules.
   - Make duration, frame rate, dimensions, aspect ratio and style configurable per production.
   - Validate references, IDs, timeline bounds, overlaps, asset availability, required fields and schema migrations.

3. **Simple production intake**
   - Provide a clear way to submit a story idea, script or production Bible and choose output settings.
   - Support DOCX, TXT and JSON initially; add PDF only when extraction is reliable.
   - Preserve the original input and source references; report unsupported formats, ambiguity and missing information.
   - Make a normal production start possible without editing code or manually constructing JSON.

4. **Story interpretation and planning**
   - Convert input into a normalized creative brief, script, narrative beats, scene/shot plan and production manifest.
   - Maintain causality, chronology, character identity, location continuity and target runtime.
   - Flag uncertain high-impact decisions; do not silently invent essential story facts.
   - Validate spoken-word duration and scene timing before asset generation.

5. **Reusable asset and continuity library**
   - Store and version character, rig, environment, prop, material, lighting, animation, typography and audio assets.
   - Resolve and validate all asset references before rendering.
   - Preserve approved character and environment identity across scenes and future episodes.
   - Define asset provenance, licensing/originality metadata and fallback behavior.

6. **Production-ready character and rig engine**
   - Implement reusable rigs rather than placeholder-only primitive figures.
   - Support body proportions, clothing, hair, faces, materials, accessories, shadows and expressive facial performance.
   - Support locomotion, gestures, gaze, poses, reactions, interactions and retargetable animation clips.
   - Validate foot contact, joint limits, clipping, pose transitions and character consistency.

7. **Environment, prop and interaction engine**
   - Build reusable indoor/outdoor sets with geography, set dressing, lighting and interaction anchors.
   - Support props, collisions, object interactions, time of day, atmosphere, weather and environmental motion.
   - Preserve deterministic spatial continuity and scene layout.
   - Support story-specific supernatural/visual effects through data and reusable modules, not one-off renderer edits.

8. **Animation, choreography and camera engine**
   - Implement timeline-driven actor tracks, path movement, blocking, choreography, interactions and composable overlapping actions.
   - Implement camera framing, lens/FOV, tracking, pans, tilts, push-ins, focus targets and keyframe interpolation.
   - Support transitions, particles and reusable visual effects.
   - Ensure animation remains fluid and deterministic at the configured frame rate.

9. **Narration, dialogue and voice identity**
   - Generate or ingest narration/dialogue with configurable providers and voice profiles.
   - Preserve pronunciation, pacing, pauses and character voice continuity.
   - Derive word-level alignment from the final audio file, never estimated script timings.
   - Synchronize character performance and lip/mouth cues where applicable.

10. **Music, ambience and sound design**
    - Support original/licensed music, ambience, Foley and timed sound effects.
    - Implement cue timing, fades, ducking, mixing, silence and voice prioritization.
    - Detect missing tracks, clipping, excessive peaks, unintended silence and narration masking.
    - Keep audio cue definitions in production data.

11. **Captions and graphic composition**
    - Generate word-synchronized captions from final audio alignment.
    - Support typography, emphasis, animation, safe areas and face/clue avoidance.
    - Add title cards, labels and overlays without obscuring story information.
    - Validate spelling, punctuation, line length, timing and mobile readability.

12. **Preview-first rendering and operator controls**
    - Render shots/scenes at review resolution before expensive masters.
    - Generate scene contact sheets and preview MP4s.
    - Support selective rerendering and deterministic reproduction of a shot.
    - Provide clear job status, stage progress, logs, preview access and retry/failure explanations.
    - Never launch a full master before required preview gates pass.

13. **Automated technical QA**
    - Validate codec, dimensions, aspect ratio, FPS, duration, frame count, audio/video streams and full-file decode.
    - Detect black/frozen frames, missing media, corrupt output, timeline gaps, subtitle overflow and audio/video sync defects.
    - Verify uploaded files by signed retrieval and decode, not upload response alone.

14. **Automated creative QA**
    - Evaluate hook, narrative clarity, continuity, visual readability, animation quality, shot purpose, character consistency, caption readability, sound mix and ending/payoff.
    - Use deterministic checks where possible and model-assisted review with timecodes and evidence for subjective checks.
    - Produce severity-ranked issue reports with scene/timecode and pass/fail status.

15. **Repair and selective rerender**
    - Convert QA findings into bounded, actionable repair tasks.
    - Repair only affected production data, assets or shots.
    - Rerender impacted shots and repeat dependent QA.
    - Enforce retry budgets, idempotency and stop conditions; never loop indefinitely.

16. **Durable orchestration and persistence**
    - Implement explicit job states, idempotency keys, stage-level retries, cancellation, recovery and progress reporting.
    - Persist projects, manifests, scenes, asset metadata, logs, QA reports and outputs in Supabase.
    - Keep storage private and use expiring signed access.
    - Define Render API, GitHub Actions and Supabase responsibilities clearly; GitHub Actions orchestrates execution, Render hosts the backend API, and Supabase persists records/assets unless verified architecture changes are approved.

17. **End-to-end operator workflow and delivery**
    - Implement the complete flow: submit → parse → interpret → plan → validate → resolve/generate assets → audio → preview → QA → repair → master render → storage → report.
    - Make routine production require no manual video assembly or source-code changes.
    - Deliver MP4 plus script, storyboard/scene timing, asset manifest, word-level subtitle timing, technical QA report and creative QA notes.
    - Provide clear errors, job history and a way to retrieve all outputs.

18. **Software reliability, security and performance**
    - Test malformed inputs, missing assets, provider outages, interrupted jobs, duplicate requests, concurrent jobs, storage failures, retries and recovery.
    - Verify secrets are not exposed, internal tables remain protected and storage remains private.
    - Measure queue latency, render time, memory, storage size and failure rates.
    - Test free-tier constraints and graceful resource-limit handling.

19. **Stage A software acceptance gate**
    - All builds, types, unit/integration/security tests and required smoke renders pass.
    - Generic manifests and input formats are validated.
    - A synthetic multi-scene production completes the full software pipeline without using Episode 01 as a special case.
    - Preview, technical QA, creative QA, bounded repair, final assembly, private storage retrieval and production report are proven.
    - A normal operator can submit a new story and retrieve results without editing code.
    - Only after this gate is met may Stage B begin.

## Stage B — Example production (only after Stage A passes)

20. **Episode 01 benchmark production**
    - Submit the supplied “Never Trust Your Shadow” Production Bible through the normal intake workflow.
    - Produce the example reel using the finished generic software, with no story-specific renderer source changes.
    - Compare all nine scenes, story beats, Alex/shadow continuity, independent shadow movement, camera direction, narration, sound, word-synchronized captions and cliffhanger against the Bible.
    - Inspect the actual video at phone size and listen to the audio.
    - Fix any defects in the generic software, then rerun the affected stages and full acceptance checks.
    - Deliver the final MP4 and every Bible-required production artifact with technical and creative QA evidence.

## Stage C — Generalization and final release

21. **Independent second-story generalization**
    - Submit a materially different story/Bible through the same intake workflow.
    - Run it without changing story-specific renderer code.
    - Confirm the system adapts through manifests, reusable assets and supported engine capabilities.

22. **Final production-readiness decision**
    - Both stories pass technical and creative acceptance.
    - Final MP4s are independently decoded and retrieved from private Supabase storage.
    - Production reports, asset manifests and recovery evidence are available.
    - No critical defects, unresolved security issues or unbounded failure loops remain.
    - Keep the PR unmerged until all gates pass; then document the release and operating procedure.

## Non-negotiable architecture and sequencing rules

1. Build the software before producing the example video.
2. The renderer stays generic; story-specific details belong in validated manifests and reusable assets.
3. The target is coherent 3D animation, not a slideshow or static-image sequence.
4. Narration alignment comes from final generated audio.
5. Preview and creative QA precede expensive master rendering.
6. A failed stage cannot silently pass; retries are bounded and recorded.
7. A production is complete only when the final MP4 is independently validated, stored, retrievable and reviewed.
8. Episode 01 passing is necessary but insufficient; the second story must also pass without renderer source changes.
