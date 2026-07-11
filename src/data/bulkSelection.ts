// Pure helpers for the Visits bulk-selection feature. Framework-free so the
// toggle / select-all semantics can be unit-tested without React.

/** Return a new set with `id` toggled (added if absent, removed if present). */
export function toggleId(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** A fresh selection containing exactly the given ids. */
export function selectAll(ids: string[]): Set<string> {
  return new Set(ids)
}

/**
 * True when every id in `ids` is currently selected (and there is at least one
 * id). Drives the "select all on this page" master checkbox's checked state.
 */
export function allSelected(set: ReadonlySet<string>, ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => set.has(id))
}
