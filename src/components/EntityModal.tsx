import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'

const btnBase: CSSProperties = {
  borderRadius: 9,
  padding: '10px 18px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
}

export function EntityModal({
  title,
  onClose,
  onSubmit,
  submitLabel,
  isMobile,
  children,
}: {
  title: string
  onClose: () => void
  onSubmit: () => void
  submitLabel: string
  isMobile: boolean
  children: ReactNode
}) {
  const ovPos = isMobile ? 'absolute' : 'fixed'
  return (
    <div
      onClick={onClose}
      style={{ position: ovPos, inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 500, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', background: 'var(--surface)', borderRadius: 14, boxShadow: '0 30px 80px rgba(0,0,0,.3)', animation: 'pop .18s ease' }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnBase, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
            Cancel
          </button>
          <button onClick={onSubmit} style={{ ...btnBase, border: 'none', background: 'var(--accent)', color: '#fff' }}>
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export const modalFieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  marginBottom: 9,
}

export const modalInput: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  borderRadius: 8,
  padding: '10px 12px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13,
  color: 'var(--text)',
}
