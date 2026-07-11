import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { useDialogA11y } from './useDialogA11y'

/** Read-only modal shell (no submit footer) — mirrors EntityModal's backdrop/header. */
export function DetailModal({
  title,
  subtitle,
  label,
  onClose,
  isMobile,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** Accessible name for the dialog (title may be rich JSX). */
  label: string
  onClose: () => void
  isMobile: boolean
  children: ReactNode
}) {
  const ovPos = isMobile ? 'absolute' : 'fixed'
  const { dialogProps } = useDialogA11y({ onClose, label })
  return (
    <div
      onClick={onClose}
      style={{ position: ovPos, inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'backdrop var(--motion-dur) var(--motion-ease)' }}
    >
      <div
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', background: 'var(--surface)', borderRadius: 14, boxShadow: '0 30px 80px rgba(0,0,0,.3)', animation: 'pop var(--motion-dur) var(--motion-ease)' }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>
        <div style={{ padding: '18px 22px' }}>{children}</div>
      </div>
    </div>
  )
}
