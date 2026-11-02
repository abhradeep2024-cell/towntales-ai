-- Add project/asset records and bounded retry metadata without altering unrelated tables.
create table if not exists public.film_studio_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  description text,
  default_style_id text,
  default_aspect_ratio text not null default '16:9' check (default_aspect_ratio in ('16:9','9:16','1:1')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.film_studio_projects enable row level security;

alter table public.film_studio_jobs
  add column if not exists project_id uuid references public.film_studio_projects(id) on delete set null;
alter table public.film_studio_jobs
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0);
alter table public.film_studio_jobs
  add column if not exists max_attempts integer not null default 2 check (max_attempts between 1 and 5);
create index if not exists film_studio_jobs_project_created_idx
  on public.film_studio_jobs(project_id, created_at desc);

create table if not exists public.film_studio_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.film_studio_projects(id) on delete cascade,
  job_id uuid references public.film_studio_jobs(id) on delete set null,
  scene_id text,
  asset_type text not null check (asset_type in ('image','video','audio','font','subtitle','data','other')),
  storage_key text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists film_studio_assets_project_created_idx
  on public.film_studio_assets(project_id, created_at desc);
create index if not exists film_studio_assets_job_idx
  on public.film_studio_assets(job_id);
alter table public.film_studio_assets enable row level security;

create or replace function public.claim_film_studio_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare claimed public.film_studio_jobs;
begin
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
