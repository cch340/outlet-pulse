import { useStore } from '../data/store'
import { useSession } from '../auth/AuthProvider'
import { useOverdueCount } from '../data/queries/useOverdueCount'
import { NAV } from '../data/nav'
import { Icon } from './Icon'

export function Sidebar() {
  const { state, go } = useStore()
  const { session, signOut } = useSession()
  const overdueCount = useOverdueCount()
  const email = session?.user.email ?? ''
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <aside
      style={{
        width: 228,
        flexShrink: 0,
        background: 'var(--sidebar)',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 14px',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 18px' }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          P
        </div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '-.01em' }}>OutletPulse</div>
      </div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--sidebar-text)',
          fontWeight: 600,
          padding: '8px 8px 6px',
          opacity: 0.7,
        }}
      >
        Monitoring
      </div>
      {NAV.map((n) => {
        const active = n.key === state.activeScreen
        const badge = n.key === 'visits' && overdueCount ? String(overdueCount) : ''
        return (
          <button
            key={n.key}
            onClick={() => go(n.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              width: '100%',
              padding: '9px 11px',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: "'IBM Plex Sans'",
              fontSize: 13.5,
              fontWeight: active ? 600 : 500,
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : 'var(--sidebar-text)',
            }}
          >
            <Icon name={n.icon} size={20} />
            <span style={{ flex: 1, textAlign: 'left' }}>{n.label}</span>
            {badge && (
              <span
                style={{
                  fontFamily: "'IBM Plex Mono'",
                  fontSize: 11,
                  fontWeight: 600,
                  background: '#dc2626',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '1px 7px',
                }}
              >
                {badge}
              </span>
            )}
          </button>
        )
      })}
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 8px',
          borderTop: '1px solid rgba(255,255,255,.08)',
          marginTop: 8,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 600,
            fontSize: 12,
            fontFamily: "'IBM Plex Mono'",
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {email}
          </div>
          <div style={{ color: 'var(--sidebar-text)', fontSize: 11 }}>Signed in</div>
        </div>
        <button
          onClick={() => signOut()}
          title="Sign out"
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--sidebar-text)',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
          }}
        >
          <Icon name="logout" size={20} />
        </button>
      </div>
    </aside>
  )
}
