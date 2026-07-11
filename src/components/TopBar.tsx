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

  const onVisits = state.activeScreen === 'visits'
  const [searchExpanded, setSearchExpanded] = useState(false)

  // Auto-expand the mobile search when arriving on Visits with an active query
  // (e.g. deep link `#/visits?q=…`), and reset when leaving the screen.
  useEffect(() => {
    if (!onVisits) {
      setSearchExpanded(false)
      return
    }
    if (state.q) setSearchExpanded(true)
  }, [onVisits, state.q])

  const searchMode = isMobile && onVisits && searchExpanded

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
      {!searchMode && (
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
      )}
      {onVisits ? (
        <VisitsSearch
          isMobile={isMobile}
          expanded={searchExpanded}
          onExpand={() => setSearchExpanded(true)}
          onCollapse={() => setSearchExpanded(false)}
        />
      ) : (
        <div style={{ flex: 1 }} />
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

/** Debounced search box for the Visits screen. Local state drives the input for
 *  responsiveness; the store (and thus the RPC) is updated ~250ms after typing stops. */
function VisitsSearch({
  isMobile,
  expanded,
  onExpand,
  onCollapse,
}: {
  isMobile: boolean
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
}) {
  const { state, setQ } = useStore()
  const [value, setValue] = useState(state.q)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Auto-focus the input when the mobile search bar expands.
  useEffect(() => {
    if (isMobile && expanded) inputRef.current?.focus()
  }, [isMobile, expanded])

  const clear = () => {
    setValue('')
    setQ('')
  }

  // Mobile, collapsed: show a compact search icon button. A subtle accent dot
  // signals an active filter so it's never hidden behind the icon.
  if (isMobile && !expanded) {
    return (
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
        <button
          onClick={onExpand}
          aria-label="Search visits"
          title="Search visits"
          style={{
            position: 'relative',
            width: 38,
            height: 38,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Icon name="search" size={18} color="var(--dim)" />
          {value && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
              }}
            />
          )}
        </button>
      </div>
    )
  }

  const bar = (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        maxWidth: isMobile ? undefined : 320,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 38,
        padding: '0 10px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
        animation: isMobile ? 'fadein var(--motion-dur-fast) var(--motion-ease)' : undefined,
      }}
    >
      <Icon name="search" size={18} color="var(--dim)" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search brand, outlet or staff…"
        aria-label="Search visits by brand, outlet or staff"
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

  // Desktop: inline bar only. Mobile (expanded): full-flex bar with a back
  // affordance that collapses search mode (an active query is kept intact).
  if (!isMobile) return bar

  return (
    <>
      <button
        onClick={onCollapse}
        aria-label="Close search"
        title="Close search"
        style={{
          width: 38,
          height: 38,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface2)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <Icon name="arrow_back" size={18} color="var(--dim)" />
      </button>
      {bar}
    </>
  )
}
