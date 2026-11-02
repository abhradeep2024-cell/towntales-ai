-- Apply only to a dedicated or explicitly approved Film Studio Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.film_studio_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  idea text not null check (char_length(idea) between 1 and 8000),
  status text not null default 'queued' check (status in ('queued','rendering','uploading','completed','failed','cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  production_specification jsonb not null,
  output_key text,
  output_bytes bigint check (output_bytes is null or output_bytes > 0),
  qc_report jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completed_job_has_output check (status <> 'completed' or (output_key is not null and output_bytes is not null and qc_report is not null))
);
create index if not exists film_studio_jobs_queue_idx on public.film_studio_jobs (created_at) where status = 'queued';
create index if not exists film_studio_jobs_status_updated_idx on public.film_studio_jobs (status, updated_at desc);
alter table public.film_studio_jobs enable row level security;

create table if not exists public.film_studio_job_logs (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.film_studio_jobs(id) on delete cascade,
  level text not null check (level in ('debug','info','warn','error')),
  message text not null check (char_length(message) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists film_studio_job_logs_job_time_idx on public.film_studio_job_logs (job_id, created_at);
alter table public.film_studio_job_logs enable row level security;

create or replace function public.claim_film_studio_job()
returns jsonb language plpgsql security definer set search_path = public as $$
declare claimed public.film_studio_jobs;
begin
  select * into claimed from public.film_studio_jobs where status = 'queued'
  order by created_at for update skip locked limit 1;
  if claimed.id is null then return null; end if;
  update public.film_studio_jobs set status = 'rendering',progress = 1,updated_at = now()
  where id = claimed.id returning * into claimed;
  return to_jsonb(claimed);
end;
$$;
revoke all on function public.claim_film_studio_job() from public, anon, authenticated;
grant execute on function public.claim_film_studio_job() to service_role;
