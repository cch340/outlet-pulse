-- 0012_brand_sort.sql
-- Adds a user-controllable display order to brands, mirroring task_templates.sort.
-- Every table is per-user scoped (owner_id) since 0003_per_user_scoping.sql.
-- Apply AFTER 0011_latest_failed_tasks_by_month.sql in the Supabase SQL editor.

alter table brands add column sort int not null default 0;

-- Backfill existing rows per owner using the current alphabetical (name) order.
update brands b
set sort = s.rn
from (
  select id, (row_number() over (partition by owner_id order by name) - 1) as rn
  from brands
) s
where b.id = s.id;
