-- These tables are managed exclusively by the authenticated backend worker/API.
-- Keep RLS enabled and remove unused direct Data API privileges from client roles.
revoke all privileges on table
  public.film_studio_jobs,
  public.film_studio_job_logs,
  public.film_studio_projects,
  public.film_studio_assets
from anon, authenticated;
