/** Pure copy for the once-per-session overdue digest notification. */

/** Message for the overdue digest, or null when there's nothing overdue. */
export function digestMessage(count: number): string | null {
  if (count <= 0) return null
  const noun = count === 1 ? 'overdue visit' : 'overdue visits'
  return `You have ${count} ${noun} — check the Visits tab.`
}
