-- Cache trade-area demographics (5-mile radius, US Census ACS) per property so
-- the verdict modal doesn't re-fetch on every view.
alter table properties
  add column if not exists demographics_json jsonb,
  add column if not exists demographics_at timestamptz;

-- Partial index for the backfill query (geocoded rows with no demographics yet).
create index if not exists properties_needs_demographics_idx
  on properties (user_id)
  where latitude is not null and demographics_json is null;
