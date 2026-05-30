-- Cache geocoded coordinates so the map view doesn't re-geocode on every load.
alter table properties
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geocoded_at timestamptz;

-- Partial index for the backfill query (rows with an address but no coords yet).
create index if not exists properties_needs_geocode_idx
  on properties (user_id)
  where address is not null and latitude is null;
