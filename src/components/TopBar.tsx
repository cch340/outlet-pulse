import { useEffect, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useSession } from '../auth/AuthProvider'
import { TITLES } from '../data/nav'
import { Icon } from './Icon'
import { Mark } from './Logo'

export function TopBar() {
  const { state, openAdd, openSettings } = useStore()
  const { session, signOut } = useSession()
  const isMobile = state.isMobile
  const [title, subtitle] = TITLES[state.activeScreen]
  const email = session?.user.email ?? ''

  const [menuOpen, setMenuOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <header
      style={{
        flexShrink: 0,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 var(--pad)',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {isMobile && (
        <div ref={accountRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            title="Account"
            aria-label="Account"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            style={{
              width: 32,
              height: 32,
              border: 'none',
              background: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Mark size={32} radius={20} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                zIndex: 20,
                minWidth: 220,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,.18)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {email}
                </div>
                <div style={{ fontSize: 11, color: 'var(--dim)' }}>Signed in</div>
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  openSettings()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontFamily: "'IBM Plex Sans'",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <Icon name="settings" size={18} color="var(--dim)" />
                Settings
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  signOut()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '12px 14px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontFamily: "'IBM Plex Sans'",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <Icon name="logout" size={18} color="var(--dim)" />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--dim)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {subtitle}
        </div>
      </div>
      {state.activeScreen === 'visits' ? <VisitsSearch isMobile={isMobile} /> : <div style={{ flex: 1 }} />}
      <button
        onClick={openAdd}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 38,
          padding: '0 14px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          fontFamily: "'IBM Plex Sans'",
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <Icon name="add" size={18} />
        {!isMobile && <span>Schedule</span>}
      </button>
    </header>
  )
}

/** Debounced search box for the Visits screen. Local state drives the input for
 *  responsiveness; the store (and thus the RPC) is updated ~250ms after typing stops. */
function VisitsSearch({ isMobile }: { isMobile: boolean }) {
  const { state, setQ } = useStore()
  const [value, setValue] = useState(state.q)

  // Reflect external changes to `q` (e.g. cleared on navigation) back into the input.
  useEffect(() => {
    setValue(state.q)
  }, [state.q])

  // Debounce the store update so the RPC doesn't fire on every keystroke.
  useEffect(() => {
    if (value === state.q) return
    const timer = setTimeout(() => setQ(value), 250)
    return () => clearTimeout(timer)
  }, [value, state.q, setQ])

  const clear = () => {
    setValue('')
    setQ('')
  }

  return (
    <div
      style={{
        flex: 1,
        maxWidth: isMobile ? undefined : 320,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 38,
        padding: '0 10px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}
    >
      <Icon name="search" size={18} color="var(--dim)" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search visits…"
        aria-label="Search visits"
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontFamily: "'IBM Plex Sans'",
          fontSize: 13,
          color: 'var(--text)',
        }}
      />
      {value && (
        <button
          onClick={clear}
          aria-label="Clear search"
          title="Clear search"
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--dim)',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  )
}
