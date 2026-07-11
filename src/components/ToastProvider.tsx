import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../data/store'
import { Icon } from './Icon'
import { addToast, removeToast, type Toast, type ToastVariant } from '../data/toastQueue'

/** How long a toast lingers before it auto-dismisses. */
const AUTO_DISMISS_MS = 3500

const VARIANT: Record<ToastVariant, { color: string; icon: string }> = {
  success: { color: '#16a34a', icon: 'check_circle' },
  error: { color: '#dc2626', icon: 'error' },
  info: { color: 'var(--accent)', icon: 'info' },
}

export interface ToastApi {
  success(message: string): void
  error(message: string): void
  info(message: string): void
}

const Ctx = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((list) => removeToast(list, id))
    const t = timers.current.get(id)
    if (t) {
      clearTimeout(t)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId.current++
      setToasts((list) => addToast(list, { id, variant, message }))
      timers.current.set(id, setTimeout(() => dismiss(id), AUTO_DISMISS_MS))
    },
    [dismiss],
  )

  // Clear any pending timers if the provider unmounts.
  useEffect(() => {
    const map = timers.current
    return () => map.forEach(clearTimeout)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }),
    [push],
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  )
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const { state } = useStore()
  const isMobile = state.isMobile
  if (toasts.length === 0) return null
  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 200,
        // Bottom-center on mobile (clear of the bottom nav), bottom-right on desktop.
        bottom: isMobile ? 76 : 24,
        left: isMobile ? 12 : 'auto',
        right: isMobile ? 12 : 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: isMobile ? 'stretch' : 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const v = VARIANT[t.variant]
        return (
          <div
            key={t.id}
            role="status"
            onClick={() => onDismiss(t.id)}
            title="Dismiss"
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: isMobile ? 0 : 260,
              maxWidth: 400,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${v.color}`,
              borderRadius: 10,
              padding: '11px 14px',
              boxShadow: '0 12px 34px rgba(0,0,0,.18)',
              fontFamily: "'IBM Plex Sans'",
              fontSize: 13,
              color: 'var(--text)',
              animation: 'fadein var(--motion-dur) var(--motion-ease)',
            }}
          >
            <Icon name={v.icon} size={19} color={v.color} />
            <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}

export function useToast(): ToastApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast must be used within ToastProvider')
  return v
}
