# Real Factory execution tracker

**Goal:** A reusable automated production system that turns a supplied script or production Bible into a polished, cinematic, 60-second 3D animated reel with synchronized narration, dialogue, music, sound effects and captions.

**Acceptance authority:** The Episode 01 Production Bible and the Real Factory End Goal & Production Standard. The Episode 01 Bible is a benchmark input, not a hardcoded renderer specification.

**Execution rule:** Work in order. A phase is complete only when its implementation, automated tests and relevant runtime evidence pass. Do not mark a successful command as proof of creative quality. Do not merge the remediation PR until acceptance gates pass.

## Ordered task register

| # | Task | Exit evidence |
|---:|---|---|
| 1 | Baseline audit and CI repair | Clean build, type checks, tests, security scan and required smoke renders |
| 2 | Universal production contract | Versioned schema validates project settings, characters, assets, scenes, shots, camera, actions, dialogue, audio, captions and QA |
| 3 | Story/Bible intake | DOCX, TXT and JSON inputs parsed with source traceability and ambiguity reporting |
| 4 | Story understanding and production planning | Generic structured production plan generated from arbitrary story input |
| 5 | Reusable asset and continuity library | Versioned characters, rigs, environments, props, materials, lighting, animation and audio assets resolve consistently |
| 6 | Character and rig system | Reusable production-ready rigs, expressive performance, locomotion and validated transitions |
| 7 | Environment and prop system | Reusable sets, spatial continuity, lighting and interactive props |
| 8 | Animation, choreography and camera engine | Deterministic actor tracks, overlapping actions, pathing, interaction, camera choreography and effects |
| 9 | Narration and dialogue | Final audio generated/ingested, voice continuity and word alignment derived from final audio |
| 10 | Music and sound design | Timed music, ambience, Foley, effects, ducking, mixing and audio defect detection |
| 11 | Captions and graphic composition | Word-synchronized animated captions, safe areas and overlays |
| 12 | Preview-first rendering | Review-resolution scene renders, full preview MP4, contact sheets and selective rerender |
| 13 | Automated technical QA | Codec, resolution, FPS, duration, decode, streams, sync, black/frozen frames and integrity checks |
| 14 | Automated creative QA | Evidence-based checks for story, continuity, performance, composition, captions and sound |
| 15 | Repair and selective rerender | Bounded repair tasks and rerender only impacted shots, followed by repeat QA |
| 16 | Final assembly and delivery | Approved master MP4, production report, manifest, asset versions and QA evidence |
| 17 | Orchestration and persistence | Durable states, idempotency, retries, recovery, progress, logs and private Supabase storage |
| 18 | End-to-end automation | Script-to-delivery pipeline runs without manual video assembly |
| 19 | Episode 01 benchmark acceptance | Actual Episode 01 output passes technical and creative Bible review |
| 20 | Second-story generalization | A materially different story runs without story-specific renderer code changes |
| 21 | Reliability, security and performance | Recovery, concurrency, secret handling, private storage and resource limits tested |
| 22 | Final acceptance | All critical tests and both story benchmarks pass; deliverables independently retrieved and decoded |

## Current verified snapshot

As of workflow run [41676137909](https://github.com/abhradeep2024-cell/towntales-ai/actions/runs/41676137909), branch `work/towntales-bible-remediation`, commit `abe450a823be1a6d97826010760f7c400904250f`:

- Checkout, repository secret scan, dependency installation, build/type-check, unit tests and audio alignment/caption tests: passed.
- Render API/database integration check: skipped in this run; not evidence of live API/database success.
- Landscape Remotion smoke, narration/music mux, three-scene timeline, declarative 3D smoke, vertical render, Lemo contract and Art Deco engine smoke: passed.
- Episode 01 narration preparation and nine-scene low-resolution preview render/contact sheet: passed.
- Full-resolution Episode 01 master render: in progress at the time this tracker was written.
- MP4 validation, full-resolution frame, Supabase private upload/signed download/decode, visual contact sheet and artifact upload: pending.

**Current phase:** Phase 1 baseline/CI validation is still in progress. A low-resolution preview exists as a workflow artifact candidate, but final video delivery and visual acceptance are not yet established.

## Non-negotiable quality rules

1. The renderer stays generic; story-specific content belongs in validated production data and reusable assets.
2. The target is actual coherent 3D animation, not a slideshow or a sequence of static images.
3. Narration alignment must come from the final generated audio.
4. Scene continuity, character identity, camera intent, motion quality and sound synchronization must be reviewed.
5. Preview and creative QA precede expensive final rendering.
6. A failed stage cannot silently pass; retries are bounded and recorded.
7. A production is not complete until the final MP4 is independently validated, stored and retrievable with its report.
8. Episode 01 passing is necessary but insufficient; a different story must pass through the same engine without renderer source changes.
