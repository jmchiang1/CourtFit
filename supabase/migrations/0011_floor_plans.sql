-- Standalone floor plans. Previously a plan lived inside a single property
-- (`properties.layout_json`, migration 0008); plans are now first-class,
-- listed under their own tab and editable independently of any listing.
--
-- `property_id` is an optional link back to the listing a plan was seeded from
-- (size + clear height) — kept for provenance only, and nulled if that property
-- is deleted so the plan survives.
create table if not exists floor_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  name text not null default 'Untitled floor plan',
  property_id uuid references properties(id) on delete set null,

  -- { version, name, footprintMode, building, zones, items } — see
  -- lib/floor-planner/types.ts (FloorPlanLayout).
  layout_json jsonb not null
);

create index if not exists floor_plans_user_id_idx on floor_plans(user_id);
create index if not exists floor_plans_updated_at_idx on floor_plans(updated_at desc);

alter table floor_plans enable row level security;

drop policy if exists "own rows" on floor_plans;
create policy "own rows" on floor_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Carry over any plans already drawn against a property so nothing is lost when
-- the panel moves out of the verdict modal. Idempotent: skips properties whose
-- plan has already been migrated.
insert into floor_plans (user_id, created_at, updated_at, name, property_id, layout_json)
select
  p.user_id,
  coalesce(p.layout_updated_at, p.created_at, now()),
  coalesce(p.layout_updated_at, p.created_at, now()),
  coalesce(nullif(p.layout_json ->> 'name', ''), p.label, p.address, 'Untitled floor plan'),
  p.id,
  p.layout_json
from properties p
where p.layout_json is not null
  and not exists (select 1 from floor_plans f where f.property_id = p.id);
