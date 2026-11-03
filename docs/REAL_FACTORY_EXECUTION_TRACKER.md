# Real Factory execution tracker

**Goal:** Build a reusable automated animation studio that turns a supplied story or production Bible into a polished animated reel.

**Mandatory sequence:** Finish and accept the software first. Do not produce the Episode 01 example video until the Stage A software acceptance gate passes. Episode 01 is the first post-software demonstration and creative benchmark.

## Delivery stages

- **Stage A — Software:** implement the complete generic production engine and operator workflow; validate using automated tests and synthetic fixtures.
- **Stage B — Example:** after software acceptance, produce Episode 01 from its Bible through normal intake and inspect the real video against the Bible.
- **Stage C — Generalization:** run a materially different story without story-specific renderer source changes.

## Ordered task register

| # | Task | Required completion evidence |
|---:|---|---|
| 1 | Repository/infrastructure baseline | Clean build, types, tests, security scan, verified API/database integration, stable CI |
| 2 | Universal production contract | Versioned schema covers project settings, characters, assets, scenes, shots, camera, actions, dialogue, audio, captions and QA |
| 3 | Simple production intake | Submit story/script/Bible via supported formats without hand-authoring JSON or editing code |
| 4 | Story interpretation/planning | Generic brief, script, beats, shot plan and validated manifest with ambiguity reporting |
| 5 | Asset/continuity library | Versioned reusable characters, rigs, environments, props, materials, lighting, animation and audio assets |
| 6 | Character/rig engine | Production-ready reusable rigs, expression, locomotion, performance and validated transitions |
| 7 | Environment/prop engine | Reusable sets, spatial continuity, lighting, collision and interactions |
| 8 | Animation/choreography/camera | Deterministic actor tracks, composable actions, pathing, interactions, camera choreography and effects |
| 9 | Narration/dialogue | Final voice audio, voice identity and word alignment from final audio |
| 10 | Music/sound design | Timed music, ambience, Foley, effects, ducking, mixing and defect detection |
| 11 | Captions/graphics | Word-synchronized animated captions, safe areas, overlays and readability validation |
| 12 | Preview-first rendering/operator controls | Scene previews, contact sheets, preview MP4, selective rerender, progress/logs |
| 13 | Technical QA | Codec, resolution, FPS, duration, full decode, streams, sync, black/frozen frames and integrity |
| 14 | Creative QA | Evidence-based story, continuity, performance, composition, caption and sound review |
| 15 | Repair/selective rerender | Bounded repair tasks, affected-shot rerender and repeat QA |
| 16 | Durable orchestration/persistence | Job states, idempotency, retries, recovery, logs, private Supabase storage |
| 17 | End-to-end operator workflow/delivery | Submit-to-report pipeline; no manual video assembly; complete output package |
| 18 | Reliability/security/performance | Failure/recovery/concurrency tests, secrets/storage protection and resource measurements |
| 19 | **Stage A software acceptance** | Synthetic full pipeline passes; operator can submit and retrieve a production; all critical tests pass |
| 20 | **Stage B Episode 01 example** | Bible-driven reel produced by finished software; actual video reviewed against all Bible criteria |
| 21 | **Stage C second-story test** | Different story runs with no story-specific renderer code changes |
| 22 | Final acceptance/release | Both stories pass; MP4s decoded/retrieved; reports/evidence complete; no critical defects |

## Current verified execution snapshot

Repository: `abhradeep2024-cell/towntales-ai`  
Branch: `work/towntales-bible-remediation`  
PR: [#2](https://github.com/abhradeep2024-cell/towntales-ai/pull/2) (draft; do not merge before acceptance).

- Concurrency policy fix committed as `fba4dcb7438fbdaabd6e6b8e2394ba7b5bba382d`; active jobs are no longer cancelled by a newer commit in the same concurrency group.
- Run [#272](https://github.com/abhradeep2024-cell/towntales-ai/actions/runs/41682336797), commit `4e467f8ab9f1aa7229dcae0624e3fb1d6469931c`, remains in progress.
- Completed successfully: checkout, secret scan, dependency setup, build/type-check, unit tests, audio alignment/caption tests, browser setup, landscape smoke, voice/music mux, three-scene timeline, declarative 3D smoke, vertical render, Lemo contract, Art Deco engine smoke and Episode 01 narration preparation.
- The low-resolution preview step completed after the last tracker snapshot; the workflow has advanced to **full-resolution Episode 01 master render**. This is a CI validation render, not the Stage B deliverable; Stage B remains blocked until Stage A software acceptance.
- Still pending in run #272: MP4 validation, full-resolution frame inspection artifact, Supabase private upload/signed retrieval/decode, visual contact sheet and artifact upload.
- The Render API/database step was skipped for this pull-request run. It is not evidence that live Render integration is verified.
- Run [#41683580560](https://github.com/abhradeep2024-cell/towntales-ai/actions/runs/41683580560) for the concurrency-fix commit is queued/pending behind the active run.

## What is implemented so far (not yet production accepted)

- Versioned reusable-character/actor/scene contract foundation and validation tests.
- Data-driven declarative React Three Fiber/Remotion scene renderer foundation.
- Actor actions, props, basic lighting and camera keyframe support.
- Audio duration retry and word-alignment/caption pipeline tests.
- CI smoke renders and Supabase storage verification script/migration foundation.
- PR concurrency isolation with `cancel-in-progress: false`.

These foundations do **not** yet prove production-ready rigs, detailed environments, arbitrary Bible intake, generic story planning, full creative QA, automated repair, or the complete no-code operator workflow.

## Execution rules

1. Work through tasks in order and update this tracker with evidence, not assumptions.
2. Do not start the Episode 01 example production until task 19 is accepted.
3. Keep the renderer generic; story-specific content belongs in production data and reusable assets.
4. A successful TypeScript build or smoke render is not proof of creative quality.
5. Do not claim a render passed until its output is available and independently validated.
6. Do not merge PR #2 until Stage A, Episode 01, second-story generalization and final acceptance pass.
