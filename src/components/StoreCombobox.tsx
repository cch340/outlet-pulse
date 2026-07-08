import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { filterStores, groupByBrand, type StoreOption } from '../data/queries/storePicker'

const groupHeader: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  padding: '8px 12px 4px',
}

const dot = (color: string): CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: 2,
  background: color,
  flexShrink: 0,
})

export function StoreCombobox({
  options,
  value,
  onChange,
}: {
  options: StoreOption[]
  value: string
  onChange: (key: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.key === value) ?? null
  const matches = filterStores(options, query)
  const groups = groupByBrand(matches)

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  // Close the dropdown on any click outside this control.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (key: string) => {
    onChange(key)
    close()
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      {/* trigger — looks like a select; shows the current pick or a placeholder */}
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          background: 'var(--surface2)',
          borderRadius: 8,
          padding: '10px 12px',
          cursor: 'pointer',
          fontFamily: "'IBM Plex Sans'",
          fontSize: 13,
          textAlign: 'left',
          color: selected ? 'var(--text)' : 'var(--dim)',
        }}
      >
        {selected && <span style={dot(selected.brandColor)} />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? `${selected.brandName} · ${selected.outletName}` : 'Select a store'}
        </span>
        <Icon name="unfold_more" size={18} color="var(--dim)" />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 5,
            maxHeight: 300,
            overflow: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            boxShadow: '0 12px 30px rgba(0,0,0,.18)',
          }}
        >
          {/* search — pinned to the top of the list while it scrolls */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              background: 'var(--surface)',
              padding: 8,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                borderRadius: 7,
                padding: '8px 10px',
              }}
            >
              <Icon name="search" size={16} color="var(--dim)" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') close()
                  if (e.key === 'Enter' && matches.length === 1) {
                    e.preventDefault()
                    pick(matches[0].key)
                  }
                }}
                placeholder="Search brand or outlet…"
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'none',
                  outline: 'none',
                  fontFamily: "'IBM Plex Sans'",
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>

          {matches.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--dim)', padding: '12px 14px' }}>No stores match.</div>
          ) : (
            groups.map((g) => (
              <div key={g.brandId}>
                <div style={groupHeader}>{g.brandName}</div>
                {g.options.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => pick(o.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: o.key === value ? 'var(--surface2)' : 'none',
                      cursor: 'pointer',
                      padding: '9px 14px',
                      fontFamily: "'IBM Plex Sans'",
                      fontSize: 13,
                      color: 'var(--text)',
                    }}
                  >
                    <span style={dot(o.brandColor)} />
                    <span style={{ flex: 1 }}>
                      {o.brandName} · {o.outletName}
                    </span>
                    {o.key === value && <Icon name="check" size={16} color="var(--accent)" />}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
