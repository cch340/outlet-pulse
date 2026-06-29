import { useStore } from '../data/store'
import { TITLES } from '../data/nav'
import { Icon } from './Icon'

export function TopBar() {
  const { state, setSearch, toggleView, openAdd } = useStore()
  const isMobile = state.isMobile
  const [title, subtitle] = TITLES[state.activeScreen]
  const viewIcon = isMobile ? 'desktop_windows' : 'smartphone'
  const viewLabel = isMobile ? 'Desktop' : 'Mobile'

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
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          P
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
        onClick={toggleView}
        title="Toggle view"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 38,
          padding: '0 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface2)',
          color: 'var(--text)',
          fontFamily: "'IBM Plex Sans'",
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Icon name={viewIcon} size={18} />
        {!isMobile && <span>{viewLabel}</span>}
      </button>
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
