-- Floor-plan layout for a saved property. One layout per property, stored as a
-- JSONB blob ({ building, zones, footprintMode, items }). Follows the same
-- pattern as listing_json / assumptions_json and is covered by the existing
-- "own rows" RLS policy on `properties`.
alter table properties
  add column if not exists layout_json jsonb,
  add column if not exists layout_updated_at timestamptz;
