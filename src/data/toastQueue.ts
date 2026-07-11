/** Toast queue model — pure, testable logic kept out of the React layer. */

export type ToastVariant = 'success' | 'error'

export interface Toast {
  id: number
  variant: ToastVariant
  message: string
}

/** Most toasts shown at once; older ones drop off the top of the stack. */
export const MAX_TOASTS = 4

/** Append a toast, capping the stack at `max` by discarding the oldest entries. */
export function addToast(list: Toast[], toast: Toast, max: number = MAX_TOASTS): Toast[] {
  const next = [...list, toast]
  return next.length > max ? next.slice(next.length - max) : next
}

/** Remove the toast with the given id (no-op if it's already gone). */
export function removeToast(list: Toast[], id: number): Toast[] {
  return list.filter((t) => t.id !== id)
}
