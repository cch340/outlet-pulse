export interface ScheduleTaskItem {
  key: string
  label: string
  checked: boolean
  templateId?: string
  saveAsTemplate?: boolean
}

export interface SchedulePlan {
  taskLabels: string[]
  newTemplateLabels: string[]
}

export function itemsFromTemplates(
  templates: { id: string; label: string }[],
): ScheduleTaskItem[] {
  return templates.map((t) => ({
    key: t.id,
    label: t.label,
    checked: true,
    templateId: t.id,
  }))
}

export function planSchedule(
  items: ScheduleTaskItem[],
  existing: { label: string }[],
): SchedulePlan {
  const taskLabels: string[] = []
  const newTemplateLabels: string[] = []
  const seen = new Set(existing.map((t) => t.label.trim().toLowerCase()))

  for (const it of items) {
    const label = it.label.trim()
    if (!label) continue
    if (it.checked) taskLabels.push(label)
    if (it.saveAsTemplate && !it.templateId) {
      const norm = label.toLowerCase()
      if (!seen.has(norm)) {
        seen.add(norm)
        newTemplateLabels.push(label)
      }
    }
  }
  return { taskLabels, newTemplateLabels }
}
