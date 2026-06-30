-- 0006_task_status_remark.sql
-- Per-task 3-state status + free-text remark, replacing the done boolean.
-- Visit status is now derived from its tasks (app-side); the visits.status
-- column is left untouched at its 'pending' default and ignored.
-- Apply AFTER 0005_task_templates.sql in the Supabase SQL editor.

alter table visit_tasks
  add column status text not null default 'pending'
  check (status in ('pending','failed','success'));

update visit_tasks set status = case when done then 'success' else 'pending' end;

alter table visit_tasks add column remark text not null default '';

alter table visit_tasks drop column done;
