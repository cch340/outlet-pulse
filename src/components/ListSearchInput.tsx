import { Icon } from './Icon'

/** Search box for list screens (Brands/Outlets/Staff). Mirrors the Visits
 *  search look. Controlled: parent owns the query string in local screen state. */
export function ListSearchInput({
  value,
  onChange,
  placeholder,
  isMobile,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  isMobile: boolean
}) {
  return (
    <div
      style={{
        flex: isMobile ? undefined : '0 1 300px',
        width: isMobile ? '100%' : undefined,
        minWidth: 0,
        maxWidth: isMobile ? undefined : 300,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 36,
        padding: '0 10px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}
    >
      <Icon name="search" size={18} color="var(--dim)" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
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
          onClick={() => onChange('')}
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

/** Shared select styling for the list-screen sort control. */
export const listSortSelectStyle = {
  height: 36,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  borderRadius: 8,
  padding: '0 9px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--text)',
  cursor: 'pointer',
} as const
