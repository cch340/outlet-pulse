import type { TaskStatus, Visit } from '../model'

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

/** Visits whose checklist does not already contain the label (case-insensitive, trimmed). */
export function eligibleVisitsForLabel(visits: Visit[], label: string): Visit[] {
  const target = label.trim().toLowerCase()
  return visits.filter(
    (v) => !v.tasks.some((t) => t.label.trim().toLowerCase() === target),
  )
}
