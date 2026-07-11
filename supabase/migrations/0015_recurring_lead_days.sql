-- Per-schedule "create in advance" lead time. The visit for an occurrence is
-- materialized client-side up to lead_days before the occurrence date; the
-- visit's date remains the occurrence date itself.
alter table recurring_schedules
  add column lead_days int not null default 0 check (lead_days between 0 and 30);
