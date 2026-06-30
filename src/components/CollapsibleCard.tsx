import type { ReactNode } from 'react'
import { card } from '../theme'
import { Icon } from './Icon'

export function CollapsibleCard({
  id,
  title,
  open,
  onToggle,
  icon,
  iconColor,
  accessory,
  gridItem,
  children,
}: {
  id: string
  title: string
  open: boolean
  onToggle: (id: string) => void
  icon?: string
  iconColor?: string
  accessory?: ReactNode
  /** When true, a collapsed card aligns to the top of its grid row instead of
   * stretching to a taller expanded sibling's height. Only set this for cards
   * inside a multi-column grid; in a flex column it would shrink the width. */
  gridItem?: boolean
  children: ReactNode
}) {
  return (
    <div style={{ ...card, padding: '16px 18px', ...(gridItem && !open ? { alignSelf: 'start' } : null) }}>
      <button
        onClick={() => onToggle(id)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        {icon && <Icon name={icon} size={19} color={iconColor} />}
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        {accessory}
        <Icon
          name={open ? 'expand_less' : 'expand_more'}
          size={20}
          color="var(--dim)"
          style={{ marginLeft: 'auto' }}
        />
      </button>
      {open && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  )
}
