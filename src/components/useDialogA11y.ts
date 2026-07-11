import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * Shared accessibility behaviour for modal/drawer overlays.
 *
 * Attach the returned `dialogProps` (which includes `ref`) to the dialog *panel*
 * element (the inner box, not the backdrop). The panel gains:
 *  - `role`/`aria-modal`/`aria-label` semantics,
 *  - Escape-to-close (document-level; only the top-most open dialog reacts),
 *  - a focus trap (Tab / Shift+Tab cycle within the panel),
 *  - focus restoration to whatever was focused before the dialog opened.
 *
 * Nesting is handled with a module-level stack: when several dialogs are open
 * (e.g. a Confirm sitting on top of a modal) only the last-registered one closes
 * on Escape, so overlays dismiss one at a time.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

// Module-level stack of open dialogs (top of stack = most recently opened).
const dialogStack: symbol[] = []

export interface UseDialogA11yOptions {
  onClose: () => void
  label: string
  /** Defaults to 'dialog'; pass 'alertdialog' for confirmation prompts. */
  role?: 'dialog' | 'alertdialog'
  /**
   * Whether the dialog is currently open. Defaults to true. Pass the open flag
   * for always-mounted overlays that render `null` when closed, so the focus
   * trap / stack registration (re)initialises each time the panel appears.
   */
  enabled?: boolean
}

export function useDialogA11y({ onClose, label, role = 'dialog', enabled = true }: UseDialogA11yOptions) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!enabled) return
    const id = Symbol('dialog')
    dialogStack.push(id)
    const prevActive = document.activeElement as HTMLElement | null

    // Move focus into the panel: first focusable child, else the panel itself.
    const panel = ref.current
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(first ?? panel).focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Only the top-most dialog responds, so nested overlays close one at a time.
      if (dialogStack[dialogStack.length - 1] !== id) return
      e.stopPropagation()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const idx = dialogStack.indexOf(id)
      if (idx !== -1) dialogStack.splice(idx, 1)
      // Restore focus if the previously-focused element is still in the DOM.
      if (prevActive && document.contains(prevActive)) prevActive.focus()
    }
  }, [enabled])

  const onKeyDownTrap = useCallback((e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab') return
    const panel = ref.current
    if (!panel) return
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement)
    const active = document.activeElement as HTMLElement | null
    if (focusables.length === 0) {
      e.preventDefault()
      panel.focus()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey) {
      if (active === first || active === panel) {
        e.preventDefault()
        last.focus()
      }
    } else if (active === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  return {
    ref,
    dialogProps: {
      ref,
      role,
      'aria-modal': true,
      'aria-label': label,
      tabIndex: -1,
      onKeyDown: onKeyDownTrap,
    },
  }
}

/**
 * Makes a clickable non-button element (e.g. a list row `<div onClick>`)
 * keyboard-operable: role="button", tab stop, and Enter/Space activation.
 * Space is prevented from scrolling the page.
 */
export function rowButtonProps(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onKeyDown: (e: ReactKeyboardEvent) => {
      // Only the row itself activates — let nested controls (buttons) handle
      // their own key events without bubbling up and double-triggering the row.
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onActivate()
      }
    },
  }
}
