-- User-added reference (competitor) facilities, shown on the map alongside the
-- built-in curated list in lib/reference-facilities.ts. Per-user, geocoded with
-- cached 5-mile trade-area demographics — mirroring the properties table.
create table if not exists reference_facilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),

  name text not null,
  address text not null,
  sports text[] not null default '{}',

  latitude double precision,
  longitude double precision,
  geocoded_at timestamptz,

  -- Cached 5-mile trade-area demographics (null until fetched).
  demographics_json jsonb,
  demographics_at timestamptz
);

create index if not exists reference_facilities_user_id_idx on reference_facilities(user_id);

alter table reference_facilities enable row level security;

drop policy if exists "own rows" on reference_facilities;
create policy "own rows" on reference_facilities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
