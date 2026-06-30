import { useState, useCallback } from 'react'
import {
  STORAGE_KEY,
  parseState,
  isOpen as isOpenPure,
  toggle as togglePure,
  setAll as setAllPure,
  allOpen as allOpenPure,
  type CollapseState,
} from './cardCollapse'

function read(): CollapseState {
  if (typeof localStorage === 'undefined') return {}
  return parseState(localStorage.getItem(STORAGE_KEY))
}

function persist(state: CollapseState): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useCardCollapse(ids: string[]): {
  isOpen: (id: string) => boolean
  toggle: (id: string) => void
  setAll: (open: boolean) => void
  allOpen: boolean
} {
  const [state, setState] = useState<CollapseState>(read)

  const update = useCallback((next: CollapseState) => {
    setState(next)
    persist(next)
  }, [])

  const toggle = useCallback((id: string) => update(togglePure(read(), id)), [update])
  const setAll = useCallback((open: boolean) => update(setAllPure(ids, open)), [ids, update])

  return {
    isOpen: (id: string) => isOpenPure(state, id),
    toggle,
    setAll,
    allOpen: allOpenPure(state, ids),
  }
}
