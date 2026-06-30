import type { TaskStatus } from '../model'

/** Whether a task already carries a recorded result, so removing it should confirm. */
export function taskHasResult(task: { status: TaskStatus; remark: string }): boolean {
  return task.status !== 'pending' || task.remark.trim() !== ''
}
