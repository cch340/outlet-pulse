-- 0007_visit_pagination.sql
-- Server-side pagination + filtering for the Visits screen.
-- A security_invoker view computes per-visit status & task counts; two RPCs
-- do date-range / status / search / latest-per-store filtering, distinct,
-- counting and pagination in SQL. security_invoker (the default for functions)
-- keeps the existing owner_id = auth.uid() RLS in force.
-- Apply AFTER 0006_task_status_remark.sql in the Supabase SQL editor.

-- One row per visit, with derived base status, task counts, and joined names
-- for search. base_status is the three-way status; "overdue" is derived in the
-- RPCs from the caller's p_today (so it matches the browser's local "today").
create or replace view visit_with_status
with (security_invoker = true) as
select
  v.id,
  v.date,
  v.staff_id,
  v.brand_id,
  v.outlet_id,
  v.owner_id,
  b.name as brand_name,
  o.name as outlet_name,
  s.name as staff_name,
  count(t.id) as total,
  count(t.id) filter (where t.status = 'success') as success_t,
  count(t.id) filter (where t.status = 'failed')  as failed_t,
  count(t.id) filter (where t.status = 'pending') as pending_t,
  case
    when count(t.id) = 0 then 'pending'
    when count(t.id) filter (where t.status = 'pending') > 0 then 'pending'
    when count(t.id) filter (where t.status = 'failed') > 0 then 'attention'
    else 'done'
  end as base_status
from visits v
join brands  b on b.id = v.brand_id
join outlets o on o.id = v.outlet_id
left join staff s on s.id = v.staff_id
left join visit_tasks t on t.visit_id = v.id
group by v.id, v.date, v.staff_id, v.brand_id, v.outlet_id, v.owner_id,
         b.name, o.name, s.name;

grant select on visit_with_status to authenticated;

-- Page of visit ids (in display order) + the full filtered count.
create or replace function visits_page(
  p_today  date,
  p_from   date,
  p_to     date,
  p_status text,
  p_latest boolean,
  p_search text,
  p_limit  int,
  p_offset int
) returns table (id uuid, total_count bigint)
language sql stable as $$
  with ranged as (
    select w.*
    from visit_with_status w
    where (p_from is null or w.date >= p_from)
      and (p_to   is null or w.date <= p_to)
      and (
        coalesce(p_search, '') = ''
        or w.brand_name  ilike '%' || p_search || '%'
        or w.outlet_name ilike '%' || p_search || '%'
        or coalesce(w.staff_name, '') ilike '%' || p_search || '%'
      )
  ),
  scoped as (
    select x.*
    from (
      select r.*,
        case when p_latest
          then row_number() over (
                 partition by r.brand_id, r.outlet_id
                 order by r.date desc, r.id desc)
          else 1
        end as rn
      from ranged r
    ) x
    where x.rn = 1
  ),
  statused as (
    select s.id, s.date,
      case
        when s.base_status = 'pending' and s.date < p_today then 'overdue'
        else s.base_status
      end as status
    from scoped s
  ),
  filtered as (
    select * from statused
    where p_status = 'all' or status = p_status
  )
  select f.id, count(*) over () as total_count
  from filtered f
  order by f.date desc, f.id desc
  limit p_limit offset p_offset;
$$;

grant execute on function visits_page(date, date, date, text, boolean, text, int, int) to authenticated;

-- The five status-chip counts for the current date-range / latest / search
-- context (no status filter, no pagination).
create or replace function visit_status_counts(
  p_today  date,
  p_from   date,
  p_to     date,
  p_latest boolean,
  p_search text
) returns table (status text, n bigint)
language sql stable as $$
  with ranged as (
    select w.*
    from visit_with_status w
    where (p_from is null or w.date >= p_from)
      and (p_to   is null or w.date <= p_to)
      and (
        coalesce(p_search, '') = ''
        or w.brand_name  ilike '%' || p_search || '%'
        or w.outlet_name ilike '%' || p_search || '%'
        or coalesce(w.staff_name, '') ilike '%' || p_search || '%'
      )
  ),
  scoped as (
    select x.*
    from (
      select r.*,
        case when p_latest
          then row_number() over (
                 partition by r.brand_id, r.outlet_id
                 order by r.date desc, r.id desc)
          else 1
        end as rn
      from ranged r
    ) x
    where x.rn = 1
  ),
  statused as (
    select
      case
        when s.base_status = 'pending' and s.date < p_today then 'overdue'
        else s.base_status
      end as status
    from scoped s
  )
  select status, count(*) as n
  from statused
  group by status;
$$;

grant execute on function visit_status_counts(date, date, date, boolean, text) to authenticated;
