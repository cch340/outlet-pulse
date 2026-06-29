import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { isOverdue } from '../data/derived'
import { NAV } from '../data/nav'
import { Icon } from './Icon'

export function BottomNav() {
  const { state, go } = useStore()
  const { data } = useData()
  const overdueCount = data.visits.filter(isOverdue).length

  return (
    <nav
      style={{
        flexShrink: 0,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        padding: '6px 4px 8px',
      }}
    >
      {NAV.map((n) => {
        const active = n.key === state.activeScreen
        const badge = n.key === 'visits' && overdueCount ? String(overdueCount) : ''
        return (
          <button
            key={n.key}
            onClick={() => go(n.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '5px 2px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: active ? 'var(--accent)' : 'var(--dim)',
              fontFamily: "'IBM Plex Sans'",
              position: 'relative',
            }}
          >
            <span style={{ position: 'relative' }}>
              <Icon name={n.icon} size={22} />
              {badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -8,
                    fontFamily: "'IBM Plex Mono'",
                    fontSize: 9,
                    fontWeight: 600,
                    background: '#dc2626',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '0 5px',
                    lineHeight: '14px',
                  }}
                >
                  {badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>{n.short}</span>
          </button>
        )
      })}
    </nav>
  )
}
