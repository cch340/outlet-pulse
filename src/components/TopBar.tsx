import { useEffect, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useSession } from '../auth/AuthProvider'
import { TITLES } from '../data/nav'
import { Icon } from './Icon'
import { Mark } from './Logo'

export function TopBar() {
  const { state, setSearch, openAdd } = useStore()
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
      <div style={{ flex: 1 }} />
      {!isMobile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '7px 10px',
            width: 230,
          }}
        >
          <Icon name="search" size={18} color="var(--dim)" />
          <input
            value={state.q}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff, outlets…"
            style={{
              border: 'none',
              background: 'none',
              outline: 'none',
              fontFamily: "'IBM Plex Sans'",
              fontSize: 13,
              color: 'var(--text)',
              width: '100%',
            }}
          />
        </div>
      )}
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
