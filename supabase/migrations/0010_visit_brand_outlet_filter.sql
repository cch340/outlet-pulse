-- 0010_visit_brand_outlet_filter.sql
-- Adds Brand / Outlet filtering to the Visits screen RPCs.
-- The visit_with_status view already exposes brand_id / outlet_id, so only the
-- two RPCs change: each gains p_brand / p_outlet (nullable uuid) params that,
-- when non-null, restrict the ranged CTE to that brand / outlet. Both filters
-- are independent. Adding params changes the function signatures, so we drop
-- the old ones first, then recreate and re-grant.
-- Apply AFTER 0009_latest_failed_tasks.sql in the Supabase SQL editor.

drop function if exists visits_page(date, date, date, text, boolean, text, int, int);
drop function if exists visit_status_counts(date, date, date, boolean, text);

-- Page of visit ids (in display order) + the full filtered count.
create or replace function visits_page(
  p_today  date,
  p_from   date,
  p_to     date,
  p_status text,
  p_latest boolean,
  p_search text,
  p_brand  uuid,
  p_outlet uuid,
  p_limit  int,
  p_offset int
) returns table (id uuid, total_count bigint)
language sql stable as $$
  with ranged as (
    select w.*
    from visit_with_status w
    where (p_from   is null or w.date >= p_from)
      and (p_to     is null or w.date <= p_to)
      and (p_brand  is null or w.brand_id  = p_brand)
      and (p_outlet is null or w.outlet_id = p_outlet)
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
    select s.*,
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

grant execute on function visits_page(date, date, date, text, boolean, text, uuid, uuid, int, int) to authenticated;

-- The five status-chip counts for the current date-range / brand / outlet /
-- latest / search context (no status filter, no pagination).
create or replace function visit_status_counts(
  p_today  date,
  p_from   date,
  p_to     date,
  p_latest boolean,
  p_search text,
  p_brand  uuid,
  p_outlet uuid
) returns table (status text, n bigint)
language sql stable as $$
  with ranged as (
    select w.*
    from visit_with_status w
    where (p_from   is null or w.date >= p_from)
      and (p_to     is null or w.date <= p_to)
      and (p_brand  is null or w.brand_id  = p_brand)
      and (p_outlet is null or w.outlet_id = p_outlet)
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

grant execute on function visit_status_counts(date, date, date, boolean, text, uuid, uuid) to authenticated;
