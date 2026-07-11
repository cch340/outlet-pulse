import { useEffect, useRef } from 'react'
import { useOverdueCount } from '../data/queries/useOverdueCount'
import { useToast } from './ToastProvider'
import { digestMessage } from '../data/overdueDigest'
import { parseHash } from '../data/urlState'

/**
 * Shows a single informational toast, once per app session, when there are
 * overdue visits — unless the user deep-linked straight into the overdue
 * visits view (where a nudge to "check the Visits tab" would be redundant).
 * Purely informational: it never navigates.
 */
export function useOverdueDigest() {
  const toast = useToast()
  const count = useOverdueCount()
  const shown = useRef(false)
  // Captured once, from the hash the app loaded with.
  const deepLinkedOverdue = useRef(
    (() => {
      const s = parseHash(typeof window !== 'undefined' ? window.location.hash : '')
      return s.screen === 'visits' && s.visitFilter === 'overdue'
    })(),
  )

  useEffect(() => {
    if (shown.current || deepLinkedOverdue.current) return
    const msg = digestMessage(count)
    if (!msg) return
    shown.current = true
    toast.info(msg)
  }, [count, toast])
}
