import { useState } from 'react'
import { useStore } from '../data/store'
import { fmt } from '../data/derived'
import { useVisitsMissingLabel, MISSING_LABEL_LIMIT } from '../data/queries/useVisitsMissingLabel'
import { useAddTaskToVisits } from '../data/queries/useVisitMutations'
import { Icon } from './Icon'

/** Adds a single task template into multiple existing visits that don't have it yet. */
export function AddTaskToVisitsModal({ label, onClose }: { label: string; onClose: () => void }) {
  const { state } = useStore()
  const { visits: eligible, isLoading } = useVisitsMissingLabel(label)
  const addToVisits = useAddTaskToVisits()
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const allSelected = eligible.length > 0 && eligible.every((v) => selectedIds.includes(v.id))
  const toggle = (id: string) =>
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const toggleAll = () => setSelectedIds(allSelected ? [] : eligible.map((v) => v.id))

  const submit = () => {
    if (!selectedIds.length) return
    addToVisits.mutate(
      { label, visitIds: selectedIds },
      { onSuccess: onClose, onError: (e) => alert(e.message) },
    )
  }

  const ovPos = state.isMobile ? 'absolute' : 'fixed'

  const checkbox = (checked: boolean) => (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 5,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
        background: checked ? 'var(--accent)' : 'transparent',
      }}
    >
      {checked && <Icon name="check" size={14} color="#fff" />}
    </span>
  )

  return (
    <div
      onClick={onClose}
      style={{ position: ovPos, inset: 0, zIndex: 70, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          borderRadius: 14,
          boxShadow: '0 30px 80px rgba(0,0,0,.3)',
          animation: 'pop .18s ease',
        }}
      >
        {/* header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Add task to visits</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
              Add "{label}" to existing visits that don't have it yet
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '16px 22px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isLoading ? (
            <div style={{ fontSize: 13.5, color: 'var(--dim)', padding: '6px 2px' }}>Loading…</div>
          ) : eligible.length === 0 ? (
            <div style={{ fontSize: 13.5, color: 'var(--dim)', padding: '6px 2px', lineHeight: 1.5 }}>
              All visits already have this task — nothing to add.
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleAll}
                style={{ display: 'flex', alignItems: 'center', gap: 12, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}
              >
                {checkbox(allSelected)}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Select all ({eligible.length})
                </span>
              </button>
              {eligible.length === MISSING_LABEL_LIMIT && (
                <div style={{ fontSize: 11.5, color: 'var(--dim)', padding: '0 2px' }}>
                  Showing the first {MISSING_LABEL_LIMIT} visits.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {eligible.map((v) => {
                  const checked = selectedIds.includes(v.id)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggle(v.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        border: '1px solid var(--border)',
                        background: 'var(--surface2)',
                        borderRadius: 9,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {checkbox(checked)}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                          {v.brandName} · {v.outletName}
                        </span>
                        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>
                          {fmt(v.date)} · {v.staffName ?? 'Unassigned'}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={submit}
            disabled={selectedIds.length === 0 || addToVisits.isPending}
            style={{
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 8,
              padding: '9px 18px',
              fontFamily: "'IBM Plex Sans'",
              fontSize: 13,
              fontWeight: 600,
              cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedIds.length === 0 ? 0.5 : 1,
            }}
          >
            Add to {selectedIds.length || ''} visit{selectedIds.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  )
}
