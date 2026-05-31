-- AI condition assessment per property: scales the renovation estimate to the
-- space's actual state (barebones shell → full gut vs. fitted-out → light) and
-- stores the NYC / Nassau County code due-diligence checklist. Cached on the
-- row so the verdict modal doesn't re-run the vision call on every view.
alter table properties
  add column if not exists condition_json jsonb,
  add column if not exists condition_at timestamptz;
