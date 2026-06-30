import type { TaskStatus } from '../model'

/** Whether a task already carries a recorded result, so removing it should confirm. */
export function taskHasResult(task: { status: TaskStatus; remark: string }): boolean {
  return task.status !== 'pending' || task.remark.trim() !== ''
}

/** Templates whose label is not already present in the visit's checklist (case-insensitive, trimmed). */
export function importableTemplates(
  templates: { id: string; label: string }[],
  tasks: { label: string }[],
): { id: string; label: string }[] {
  const present = new Set(tasks.map((t) => t.label.trim().toLowerCase()))
  return templates.filter((tpl) => !present.has(tpl.label.trim().toLowerCase()))
}
