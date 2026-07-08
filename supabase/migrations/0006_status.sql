-- Manual outreach / viability status per property (active | contacted |
-- not_viable | leased | passed). Set by the user from the verdict modal, and
-- independent of the computed rating — e.g. a strong candidate can still be
-- marked "not_viable" once a call reveals the sports complex isn't possible.
alter table properties
  add column if not exists status text not null default 'active';
