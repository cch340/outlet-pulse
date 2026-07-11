import { createContext, useCallback, useContext, useState, type CSSProperties, type ReactNode } from 'react'
import { useStore } from '../data/store'
import { Icon } from './Icon'
import { useDialogA11y } from './useDialogA11y'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button in red for destructive actions. */
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const Ctx = createContext<ConfirmFn | null>(null)

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

const btnBase: CSSProperties = {
  borderRadius: 9,
  padding: '10px 18px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { state } = useStore()
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  )

  const settle = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  const ovPos = state.isMobile ? 'absolute' : 'fixed'
  const { dialogProps } = useDialogA11y({
    onClose: () => settle(false),
    label: pending?.title ?? 'Confirm',
    role: 'alertdialog',
    enabled: !!pending,
  })

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {pending && (
        <div
          onClick={() => settle(false)}
          style={{ position: ovPos, inset: 0, zIndex: 100, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'backdrop var(--motion-dur) var(--motion-ease)' }}
        >
          <div
            {...dialogProps}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 420, maxWidth: '100%', background: 'var(--surface)', color: 'var(--text)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", borderRadius: 14, boxShadow: '0 30px 80px rgba(0,0,0,.3)', animation: 'pop var(--motion-dur) var(--motion-ease)' }}
          >
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {pending.danger && <Icon name="warning" size={22} color="#dc2626" />}
                <div style={{ fontSize: 17, fontWeight: 700 }}>{pending.title}</div>
              </div>
              {pending.message && (
                <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>{pending.message}</div>
              )}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => settle(false)} style={{ ...btnBase, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                onClick={() => settle(true)}
                style={{ ...btnBase, border: 'none', background: pending.danger ? '#dc2626' : 'var(--accent)', color: '#fff' }}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const v = useContext(Ctx)
  if (!v) throw new Error('useConfirm must be used within ConfirmProvider')
  return v
}
