-- Reference facilities are shared competitor data, not private user records: the
-- map should show them to signed-out visitors too. Replace the single "own rows"
-- policy with public read + owner-only writes.
alter table reference_facilities enable row level security;

drop policy if exists "own rows" on reference_facilities;

drop policy if exists "public read" on reference_facilities;
create policy "public read" on reference_facilities
  for select using (true);

drop policy if exists "owner insert" on reference_facilities;
create policy "owner insert" on reference_facilities
  for insert with check (auth.uid() = user_id);

drop policy if exists "owner update" on reference_facilities;
create policy "owner update" on reference_facilities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner delete" on reference_facilities;
create policy "owner delete" on reference_facilities
  for delete using (auth.uid() = user_id);
