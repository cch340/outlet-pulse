-- 0008_dashboard_and_lookups.sql
-- Spec 2: remove the global visits fetch. Two security_invoker functions:
--   dashboard_summary  — one JSON blob with all Dashboard visit metrics
--   visits_missing_label — visits lacking a given task label (add-task modal)
-- Both build on the 0007 visit_with_status view and keep owner_id RLS in force.
-- Apply AFTER 0007_visit_pagination.sql in the Supabase SQL editor.

create or replace function dashboard_summary(
  p_today      date,
  p_year       text,
  p_month      text,
  p_list_limit int
) returns json
language sql stable as $$
  with v as (
    select w.*,
      (w.base_status = 'pending' and w.date < p_today) as is_overdue,
      (w.base_status <> 'pending') as is_done
    from visit_with_status w
  ),
  month_v as (select * from v where to_char(date, 'YYYY-MM') = p_month),
  year_v  as (select * from v where to_char(date, 'YYYY')    = p_year),
  km as (
    select json_build_object(
      'total',   count(*),
      'done',    count(*) filter (where is_done),
      'pending', count(*) filter (where base_status = 'pending'),
      'overdue', count(*) filter (where is_overdue)
    ) as j from month_v
  ),
  ky as (
    select json_build_object(
      'total',   count(*),
      'done',    count(*) filter (where is_done),
      'pending', count(*) filter (where base_status = 'pending'),
      'overdue', count(*) filter (where is_overdue)
    ) as j from year_v
  ),
  months as (
    select to_char(make_date(p_year::int, m, 1), 'YYYY-MM') as month
    from generate_series(1, 12) as m
  ),
  trend as (
    select coalesce(json_agg(
      json_build_object('month', months.month,
        'done',  coalesce(t.done, 0),
        'total', coalesce(t.total, 0))
      order by months.month), '[]'::json) as j
    from months
    left join (
      select to_char(date, 'YYYY-MM') as month,
             count(*) as total,
             count(*) filter (where is_done) as done
      from year_v group by 1
    ) t on t.month = months.month
  ),
  bb as (
    select coalesce(json_agg(
      json_build_object('brand_id', brand_id, 'done', done, 'total', total)
    ), '[]'::json) as j
    from (
      select brand_id, count(*) as total, count(*) filter (where is_done) as done
      from year_v group by brand_id
    ) b
  ),
  od as (
    select coalesce(json_agg(x.j order by x.date asc), '[]'::json) as j
    from (
      select json_build_object('id', id, 'date', date, 'brand_name', brand_name,
               'outlet_name', outlet_name, 'staff_name', staff_name) as j, date
      from v where is_overdue order by date asc limit p_list_limit
    ) x
  ),
  up as (
    select coalesce(json_agg(x.j order by x.date asc), '[]'::json) as j
    from (
      select json_build_object('id', id, 'date', date, 'brand_name', brand_name,
               'outlet_name', outlet_name, 'staff_name', staff_name) as j, date
      from v where base_status = 'pending' and date >= p_today
      order by date asc limit p_list_limit
    ) x
  )
  select json_build_object(
    'kpis_month',     (select j from km),
    'kpis_year',      (select j from ky),
    'trend',          (select j from trend),
    'brand_breakdown',(select j from bb),
    'overdue',        (select j from od),
    'upcoming',       (select j from up),
    'overdue_total',  (select count(*) from v where is_overdue),
    'upcoming_total', (select count(*) from v where base_status = 'pending' and date >= p_today)
  );
$$;

grant execute on function dashboard_summary(date, text, text, int) to authenticated;

create or replace function visits_missing_label(p_label text, p_limit int)
returns table (id uuid, date date, brand_name text, outlet_name text, staff_name text)
language sql stable as $$
  select v.id, v.date, b.name, o.name, s.name
  from visits v
  join brands  b on b.id = v.brand_id
  join outlets o on o.id = v.outlet_id
  left join staff s on s.id = v.staff_id
  where not exists (
    select 1 from visit_tasks t
    where t.visit_id = v.id
      and lower(trim(t.label)) = lower(trim(p_label))
  )
  order by v.date desc, v.id desc
  limit p_limit;
$$;

grant execute on function visits_missing_label(text, int) to authenticated;
