// Pure helpers for client-side search + sort on list screens.
// Kept framework-free so they can be unit-tested without React.

/**
 * Case-insensitive substring match of a query against any of the given fields.
 * An empty/whitespace-only query matches everything. Undefined/null fields are
 * skipped.
 */
export function matchesQuery(q: string, ...fields: (string | undefined | null)[]): boolean {
  const needle = q.trim().toLowerCase()
  if (needle === '') return true
  return fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(needle))
}

/**
 * Comparator factory. `get` projects an item to a string or number; strings are
 * compared case-insensitively via localeCompare, numbers numerically. `dir`
 * flips the order. Intended for use with Array.prototype.sort (stable).
 */
export function compareBy<T>(get: (t: T) => string | number, dir: 'asc' | 'desc'): (a: T, b: T) => number {
  const sign = dir === 'desc' ? -1 : 1
  return (a, b) => {
    const av = get(a)
    const bv = get(b)
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * sign
  }
}
