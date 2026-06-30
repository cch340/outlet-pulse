export type CollapseState = Record<string, boolean>

export const STORAGE_KEY = 'dashboard.cardCollapse'

export function isOpen(state: CollapseState, id: string): boolean {
  return state[id] === true
}

export function toggle(state: CollapseState, id: string): CollapseState {
  return { ...state, [id]: !isOpen(state, id) }
}

export function setAll(ids: string[], open: boolean): CollapseState {
  const next: CollapseState = {}
  for (const id of ids) next[id] = open
  return next
}

export function allOpen(state: CollapseState, ids: string[]): boolean {
  return ids.every((id) => isOpen(state, id))
}

export function parseState(raw: string | null): CollapseState {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CollapseState
    }
    return {}
  } catch {
    return {}
  }
}
