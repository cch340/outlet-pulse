-- 0011_latest_failed_tasks_by_month.sql
-- Adds a month filter to latest_failed_tasks so the Dashboard "Latest failed
-- tasks" card reflects the selected month + year. Per brand×outlet, returns
-- that pair's most recent COMPLETED visit (base_status 'attention' or 'done')
-- WITHIN p_month ('YYYY-MM'), together with that visit's failed tasks.
-- The signature changes (adds p_month), so drop the old zero-arg function first.
-- Builds on the 0007 visit_with_status view; security_invoker keeps the
-- owner_id = auth.uid() RLS in force.
-- Apply AFTER 0010_visit_brand_outlet_filter.sql in the Supabase SQL editor.

drop function if exists latest_failed_tasks();

create or replace function latest_failed_tasks(p_month text)
returns json
language sql stable as $$
  with completed as (
    select w.*,
      row_number() over (
        partition by w.brand_id, w.outlet_id
        order by w.date desc, w.id desc
      ) as rn
    from visit_with_status w
    where w.base_status in ('attention', 'done')
      and to_char(w.date, 'YYYY-MM') = p_month
  ),
  latest as (
    select * from completed where rn = 1
  ),
  with_tasks as (
    select
      l.brand_id,
      l.outlet_id,
      l.id,
      l.date,
      l.brand_name,
      l.outlet_name,
      l.staff_name,
      l.base_status,
      coalesce(
        (
          select json_agg(
            json_build_object('label', t.label, 'remark', t.remark)
            order by t.sort, t.label
          )
          from visit_tasks t
          where t.visit_id = l.id and t.status = 'failed'
        ),
        '[]'::json
      ) as failed
    from latest l
  )
  select coalesce(
    json_agg(
      json_build_object(
        'brand_id',    brand_id,
        'outlet_id',   outlet_id,
        'id',          id,
        'date',        date,
        'brand_name',  brand_name,
        'outlet_name', outlet_name,
        'staff_name',  staff_name,
        'base_status', base_status,
        'failed',      failed
      )
      order by brand_name, outlet_name
    ),
    '[]'::json
  )
  from with_tasks;
$$;

grant execute on function latest_failed_tasks(text) to authenticated;
