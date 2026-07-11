-- 0017_outlet_sort.sql
-- Adds a user-controllable display order to outlets, mirroring brands.sort (0012).
-- Every table is per-user scoped (owner_id) since 0003_per_user_scoping.sql.
-- Apply AFTER 0016_task_photos.sql in the Supabase SQL editor.

alter table outlets add column sort int not null default 0;

-- Backfill existing rows per owner using the current alphabetical (name) order.
update outlets o
set sort = s.rn
from (
  select id, (row_number() over (partition by owner_id order by name) - 1) as rn
  from outlets
) s
where o.id = s.id;
