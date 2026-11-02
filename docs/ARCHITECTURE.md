# Architecture

## Production flow
1. User describes a film in ChatGPT.
2. ChatGPT converts the brief into a structured production specification.
3. Lemo-Opuscar principles guide style selection, treatment, three narrative alternatives where useful, script, shots and continuity.
4. The API validates the specification and records a queued job in Supabase.
5. A Render worker claims the job using a database function.
6. Remotion composes and renders the video; FFmpeg/ffprobe validate and process it.
7. The worker uploads the completed MP4 to a private Supabase Storage bucket.
8. The API marks the job completed only after output metadata and a QC report are saved.
9. ChatGPT retrieves a short-lived signed URL and evaluates the deliverable.

## Services
- ChatGPT: director and orchestration interface.
- Lemo-Opuscar: creative methodology and style reference.
- Fastify API: authenticated job CRUD/status/cancel/output endpoints.
- Supabase Postgres: durable job state and queue.
- Supabase Storage: private media persistence.
- Render: API and renderer worker containers; local disk is disposable.
- Remotion: React-based composition and rendering.
- FFmpeg/ffprobe: decode, metadata and audio/video checks.

## Security
Separate user API token and renderer shared secret. Service-role key stays server-side. Job specs use Zod validation; no shell interpolation from user fields. Signed output links expire after five minutes. Database tables have RLS enabled and no public policies.

## Limitations
Remotion renders authored code and assets; it does not generate photorealistic footage. External generation services are excluded unless a genuinely free, permitted option is separately validated. Free instances sleep and are resource constrained; long or high-resolution jobs may fail.
