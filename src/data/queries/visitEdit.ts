import type { TaskStatus } from '../model'

/** Sort/append position for a newly added task: the end of the current list. */
export function nextTaskSort(tasks: unknown[]): number {
  return tasks.length
}

/** Whether a task already carries a recorded result, so removing it should confirm. */
export function taskHasResult(task: { status: TaskStatus; remark: string }): boolean {
  return task.status !== 'pending' || task.remark.trim() !== ''
}
