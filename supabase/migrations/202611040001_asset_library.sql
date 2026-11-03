-- Versioned reusable asset catalogue shared across productions.
create table if not exists public.film_studio_asset_library (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null check (char_length(asset_key) between 1 and 120),
  version integer not null check (version > 0),
  asset_type text not null check (asset_type in ('character','rig','environment','prop','material','texture','animation','music','voice','sound-effect','font','image','video','other')),
  display_name text not null check (char_length(display_name) between 1 and 160),
  storage_key text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  status text not null default 'ready' check (status in ('processing','ready','failed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(asset_key, version)
);
create index if not exists film_studio_asset_library_type_status_idx
  on public.film_studio_asset_library(asset_type, status, display_name);
create index if not exists film_studio_asset_library_key_version_idx
  on public.film_studio_asset_library(asset_key, version desc);
alter table public.film_studio_asset_library enable row level security;
revoke all on public.film_studio_asset_library from public, anon, authenticated;
grant all on public.film_studio_asset_library to service_role;

-- Prevent an asset version from being silently replaced after approval.
create or replace function public.reject_film_studio_asset_version_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.asset_key <> new.asset_key or old.version <> new.version or old.storage_key <> new.storage_key
     or old.sha256 is distinct from new.sha256 then
    raise exception 'Asset identity, version, storage key and checksum are immutable; publish a new version.';
  end if;
  return new;
end;
$$;
drop trigger if exists film_studio_asset_version_immutable on public.film_studio_asset_library;
create trigger film_studio_asset_version_immutable
before update on public.film_studio_asset_library
for each row execute function public.reject_film_studio_asset_version_mutation();
