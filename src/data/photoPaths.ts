// Pure helpers for task photo storage paths and client-side image sizing.
// Storage objects live in the private 'task-photos' bucket at
//   <ownerId>/<taskId>/<fileId>.jpg
// The leading <ownerId> segment is what storage RLS scopes on (foldername[1]).

/** Maximum number of photos a single task may hold. */
export const MAX_PHOTOS_PER_TASK = 5

/** Longest edge (px) a stored photo is scaled down to before upload. */
export const MAX_EDGE_PX = 1600

/** JPEG quality used when re-encoding uploaded photos. */
export const JPEG_QUALITY = 0.82

/** Storage object path for a task photo. */
export function photoPath(ownerId: string, taskId: string, fileId: string): string {
  return `${ownerId}/${taskId}/${fileId}.jpg`
}

/** Whether another photo can be added given the current count on a task. */
export function canAddPhoto(currentCount: number): boolean {
  return currentCount < MAX_PHOTOS_PER_TASK
}

/**
 * Scale (w, h) so the longest edge is at most `maxEdge`, preserving aspect
 * ratio. Never upscales (images already within bounds pass through unchanged).
 * Result dimensions are rounded to whole pixels.
 */
export function targetDimensions(
  w: number,
  h: number,
  maxEdge = MAX_EDGE_PX,
): { w: number; h: number } {
  const longest = Math.max(w, h)
  if (longest <= maxEdge) return { w: Math.round(w), h: Math.round(h) }
  const scale = maxEdge / longest
  return { w: Math.round(w * scale), h: Math.round(h * scale) }
}
