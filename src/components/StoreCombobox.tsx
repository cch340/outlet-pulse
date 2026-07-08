import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { chip } from '../theme'
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

const inputStyle: CSSProperties = {
  flex: 1,
  border: 'none',
  background: 'none',
  outline: 'none',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13,
  color: 'var(--text)',
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

  // Close the dropdown on any click outside this control.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setQuery(''); setOpen(false) }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (key: string) => {
    onChange(key)
    setQuery('')
    setOpen(false)
  }

  const matches = filterStores(options, query)
  const groups = groupByBrand(matches)

  // Collapsed state: a chip showing the selected store with a change/clear affordance.
  if (selected && !open) {
    return (
      <div ref={rootRef} style={{ display: 'flex' }}>
        <button
          onClick={() => setOpen(true)}
          style={{ ...chip(true), maxWidth: '100%' }}
          title="Change store"
        >
          <span style={dot(selected.brandColor)} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.brandName} · {selected.outletName}
          </span>
          <Icon name="close" size={15} color="#fff" />
        </button>
      </div>
    )
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          background: 'var(--surface2)',
          borderRadius: 8,
          padding: '9px 12px',
        }}
      >
        <Icon name="search" size={16} color="var(--dim)" />
        <input
          autoFocus={open}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setQuery(''); setOpen(false) }
            if (e.key === 'Enter' && matches.length === 1) {
              e.preventDefault()
              pick(matches[0].key)
            }
          }}
          placeholder="Search brand or outlet…"
          style={inputStyle}
        />
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 5,
            maxHeight: 260,
            overflow: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            boxShadow: '0 12px 30px rgba(0,0,0,.18)',
          }}
        >
          {matches.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--dim)', padding: '12px 14px' }}>
              No stores match.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.brandId}>
                <div style={groupHeader}>{g.brandName}</div>
                {g.options.map((o) => (
                  <button
                    key={o.key}
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
                    {o.brandName} · {o.outletName}
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
