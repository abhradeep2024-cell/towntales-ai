-- Recover jobs left in an active state after a GitHub Actions runner crashes or times out.
-- The renderer refreshes updated_at during progress updates; 20 minutes is longer
-- than the 15-minute worker timeout and its maximum normal render/audio stages.
create or replace function public.claim_film_studio_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.film_studio_jobs;
begin
  update public.film_studio_jobs
  set status = case when attempt_count < max_attempts then 'queued' else 'failed' end,
      progress = case when attempt_count < max_attempts then 0 else progress end,
      error = 'Recovered after renderer stopped reporting progress for 20 minutes.',
      updated_at = now()
  where status in ('rendering', 'uploading')
    and updated_at < now() - interval '20 minutes';

  select * into claimed
  from public.film_studio_jobs
  where status = 'queued' and attempt_count < max_attempts
  order by created_at
  for update skip locked
  limit 1;

  if claimed.id is null then return null; end if;

  update public.film_studio_jobs
  set status = 'rendering',
      progress = 1,
      attempt_count = attempt_count + 1,
      updated_at = now()
  where id = claimed.id
  returning * into claimed;

  return to_jsonb(claimed);
end;
$$;
revoke all on function public.claim_film_studio_job() from public, anon, authenticated;
grant execute on function public.claim_film_studio_job() to service_role;
