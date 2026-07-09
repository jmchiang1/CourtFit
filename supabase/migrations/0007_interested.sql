-- Manual "interested" star per property. Orthogonal to `status` (0006): a user
-- can flag any property as one they're interested in regardless of its outreach
-- state, and filter the list down to just those. Defaults to false so every
-- existing row reads as un-starred.
alter table properties
  add column if not exists interested boolean not null default false;
