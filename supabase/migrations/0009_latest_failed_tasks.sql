-- 0009_latest_failed_tasks.sql
-- Dashboard "Latest failed tasks" card. A security_invoker function returning,
-- per brand×outlet, that pair's most recent COMPLETED visit (base_status
-- 'attention' or 'done' — i.e. has tasks and no pending ones) together with the
-- failed tasks (label + remark) on that visit. Brand×outlets with no completed
-- visit are omitted here; the client fills them in as "No visit yet".
-- Builds on the 0007 visit_with_status view; security_invoker keeps the
-- owner_id = auth.uid() RLS in force.
-- Apply AFTER 0008_dashboard_and_lookups.sql in the Supabase SQL editor.

create or replace function latest_failed_tasks()
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

grant execute on function latest_failed_tasks() to authenticated;
