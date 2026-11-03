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

- Production contract expanded with provider-neutral assets, environments, shots, tracks, dialogue, audio cues, captions, output profiles and QA rules; validation tests cover references and timeline bounds.
- Added a backward-compatible schema v1/v2 contract and an additive `migrateProductionSpec` function; v1 remains readable and v2 migration tests are queued in CI (commit `d65ccd0b2f37ebacbaf75f0b3473c200bdc15c93`). Do not mark Task 2 complete until this run passes.
- Concurrency policy fix committed as `fba4dcb7438fbdaabd6e6b8e2394ba7b5bba382d`; active jobs are not cancelled by newer commits in the same concurrency group.
- Latest head at this snapshot: `310aae5c85fe5b7c51206c3530373b6d9ef43791` (alignment audit changes pending CI).
- Run [#41687473008](https://github.com/abhradeep2024-cell/towntales-ai/actions/runs/41687473008) completed successfully on that head.
- Its uploaded logs confirm build/type-check, unit tests, audio/caption tests, landscape and vertical smoke renders, declarative 3D, multi-scene, Lemo and Art Deco smoke renders, Episode 01 low-resolution preview, and full-resolution Episode 01 CI render all completed.
- MP4 validation passed: 60 seconds, 1080x1920, 30 FPS, H.264 + AAC, 1,800 frames; file size 5,529,907 bytes.
- Private Supabase MP4/JSON upload, signed downloads, byte integrity and MP4 decode passed. Artifact [film-studio-render-suite](https://github.com/abhradeep2024-cell/towntales-ai/actions/runs/41687473008/artifacts/13261399627) was uploaded.
- Earlier run [#41682336797](https://github.com/abhradeep2024-cell/towntales-ai/actions/runs/41682336797) failed at the Supabase upload/retrieval verification step; the subsequent head run passed that step. Treat this as a resolved run-level failure, not proof that transient storage reliability has been fully tested.
- Audio alignment audit was strengthened: compare normalized narration tokens with actual provider word-boundary tokens, report missing/unexpected tokens, and fail production below 98% matched-token coverage. Added tests for omitted tokens and punctuation/contraction handling; renderer QA uses the same 98% gate. Commits `8a04f205`, `d171fdc2`, `310aae5c`. These changes are committed but awaiting CI validation; the earlier 152/153 report still needs the new audit to identify the exact missing token on a production run.
- The Render API/database live health step is skipped on pull-request runs. Live Render/Supabase API health is therefore not verified by this successful run.
- CI's Episode 01 output is a validation artifact, **not** the Stage B example-video deliverable. Stage B remains blocked until Stage A software acceptance.

- Production intake implementation started on the branch: authenticated `POST /v1/intake` accepts base64-encoded DOCX, TXT or JSON (5 MB limit), validates/extracts source content, creates a project, stores the original and extracted text in private Supabase storage, and records both as project assets. Added extraction tests and OpenAPI documentation (commits `e9dc2912`, `ed57523f`, `18eacbbf`, `2e9cbcc0`, `8a29176e`, `a0514b21`). This is an API intake foundation, not yet the complete operator intake/planning workflow; DOCX integration, API persistence and deployment remain unverified until CI and live tests pass.
- Latest active CI run at this checkpoint: [#41701629159](https://github.com/abhradeep2024-cell/towntales-ai/actions/runs/41701629159), still rendering the low-resolution Episode 01 preview; all completed steps so far passed, with Render API/database verification skipped on this PR run. Latest branch head after intake work: `a0514b212f1f2de90b37ae6c87b6f1f0065b4599`; its CI run is queued behind the active run.
\n## Latest Stage A execution checkpoint

- The generic CI workflow has been changed so future validation runs perform engine-level smoke renders only; Episode 01-specific narration, preview, master, contact sheets and storage upload steps are no longer part of routine CI. The already-running older workflow [#41701629159](https://github.com/abhradeep2024-cell/towntales-ai/actions/runs/41701629159) was started before this change and is still executing its old Episode 01 steps; its result is not the Stage B deliverable.
- Production intake now has DOCX/TXT/JSON extraction with a 5 MB source limit, validation, original-source preservation, extracted-text storage and project asset records. API route: `POST /v1/intake`.
- Story planning now has an OpenAI-compatible provider adapter that asks for a v2 production manifest, requires reusable character references and camera tracks, and validates the response against `ProductionSpecSchema` before job creation. API route: `POST /v1/projects/{id}/plan`. Configure `AI_MODEL` and an API key in Render; no provider key has been added to the repository.
- A private, versioned reusable asset catalogue has been added with immutable asset identity/version/storage/checksum fields, service-role-only access, upload registration and signed retrieval. Migration: `202611040001_asset_library.sql`; API routes: `POST /v1/assets`, `GET /v1/assets`.
- Removed Episode 01-specific dimensions/runtime validation and Alex/shadow asset metadata/creative-review text from the generic renderer worker. The production manifest and human review checklist are now derived from each production's characters and environments.
- Added OpenAPI documentation and deployment notes for the new intake, planning and asset-library capabilities.
- The environment contract now supports reusable set props, ground color/scale, fog and stable scene-to-environment references; the generic 3D renderer consumes these values. Contract tests cover valid and invalid environment references and fog/ground constraints.
- The actor action contract and renderer now include crouch, fall, clap, dance, talk and look-at, with validation for gaze targets. These extend the existing walk/run/wave/point/turn/jump/recoil/move actions.
- Episode 01 compositions were removed from the generic Remotion root registration. The dedicated Episode 01 script/fixture remains available for the later benchmark stage, but the generic root and future CI no longer register or render it.
- Worker-side production manifests and creative-review checklists were made story-agnostic; scene actors, props, camera, lighting, environments and character definitions are now recorded from each submitted production.
- Render-worker health preflight now requires `/health` to report both database configuration and a successful database connection.
- The OpenAPI document now includes intake, project planning and reusable asset endpoints, and reflects the v1/v2 production contract and environment/asset fields.
- These are implementation changes, not accepted tasks yet. DOCX extraction, AI provider calls, Supabase migration, asset endpoints, API build/typecheck, security tests and end-to-end pipeline are pending CI and live-environment verification. Do not mark Tasks 1–5 or Stage A accepted until the evidence exists.
- Latest CI head before this checkpoint: [#41705702161](https://github.com/abhradeep2024-cell/towntales-ai/actions/runs/41705702161) queued on commit `ed3248c0ebbbbaee88d9b95dac7fe0727507e6cd`; later commits may replace pending runs under the branch concurrency group. Re-check the branch head and run status before treating any change as validated.

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
