import { useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { visitVM, staffForStore, brandById, outletById } from '../data/derived'
import { pill, chip } from '../theme'
import { Icon } from './Icon'
import type { TaskStatus } from '../data/model'
import { useSetTaskStatus, useSetTaskRemark, useMarkAllSuccess, useUpdateVisit, useAddVisitTask, useRemoveVisitTask } from '../data/queries/useVisitMutations'
import { taskHasResult } from '../data/queries/visitEdit'

const SEGMENTS: { value: TaskStatus; color: string; glyph: string; title: string }[] = [
  { value: 'pending', color: '#6b7280', glyph: '–', title: 'Pending' },
  { value: 'failed', color: '#dc2626', glyph: '✕', title: 'Failed' },
  { value: 'success', color: '#16a34a', glyph: '✓', title: 'Success' },
]

export function VisitDrawer() {
  const { state, closeVisit } = useStore()
  const setStatus = useSetTaskStatus()
  const setRemark = useSetTaskRemark()
  const markAll = useMarkAllSuccess()
  const updateVisit = useUpdateVisit()
  const addTask = useAddVisitTask()
  const removeTask = useRemoveVisitTask()
  const [newTaskLabel, setNewTaskLabel] = useState('')
  const [storePickerOpen, setStorePickerOpen] = useState(false)
  const { data } = useData()
  const S = state
  const openF = S.openVisitId ? data.visits.find((f) => f.id === S.openVisitId) : null
  if (!openF) return null

  const vm = visitVM(data, openF)
  const ovPos = S.isMobile ? 'absolute' : 'fixed'
  const storeStaff = staffForStore(data, openF.brandId, openF.outletId)

  const submitTask = () => {
    const label = newTaskLabel.trim()
    if (!label) return
    addTask.mutate(
      { visitId: openF.id, label },
      { onSuccess: () => setNewTaskLabel(''), onError: (err) => alert(err.message) },
    )
  }

  return (
    <div
      onClick={closeVisit}
      style={{ position: ovPos, inset: 0, zIndex: 50, background: 'rgba(0,0,0,.42)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 430,
          maxWidth: '100%',
          height: '100%',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border)',
          animation: 'slidein .22s ease',
        }}
      >
        {/* header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: vm.brandColor }} />
              {vm.title}
            </div>

            {/* Store (brand · outlet) — collapsed, click to choose */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                onClick={() => setStorePickerOpen((o) => !o)}
                aria-expanded={storePickerOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: 'fit-content',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  borderRadius: 8,
                  padding: '7px 11px',
                  fontFamily: "'IBM Plex Sans'",
                  fontSize: 13,
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: brandById(data, openF.brandId).color }} />
                {brandById(data, openF.brandId).name} · {outletById(data, openF.outletId).name}
                <Icon name={storePickerOpen ? 'expand_less' : 'expand_more'} size={18} />
              </button>
              {storePickerOpen && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.stores.map((s) => {
                    const b = brandById(data, s.brandId)
                    const o = outletById(data, s.outletId)
                    const active = s.brandId === openF.brandId && s.outletId === openF.outletId
                    return (
                      <button
                        key={`${s.brandId}|${s.outletId}`}
                        onClick={() => {
                          setStorePickerOpen(false)
                          if (active) return
                          const list = staffForStore(data, s.brandId, s.outletId)
                          updateVisit.mutate(
                            { visitId: openF.id, brandId: s.brandId, outletId: s.outletId, staffId: list[0]?.id ?? null },
                            { onError: (e) => alert(e.message) },
                          )
                        }}
                        style={chip(active)}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                        {b.name} · {o.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Date */}
            <input
              type="date"
              value={openF.date}
              aria-label="Visit date"
              onChange={(e) =>
                updateVisit.mutate(
                  { visitId: openF.id, date: e.target.value },
                  { onError: (err) => alert(err.message) },
                )
              }
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                borderRadius: 8,
                padding: '8px 10px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13,
                color: 'var(--text)',
                width: 'fit-content',
              }}
            />

            {/* Staff reassign */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>Staff on duty</span>
              {storeStaff.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>Unassigned</span>
              ) : (
                storeStaff.map((st) => (
                  <button
                    key={st.id}
                    onClick={() =>
                      updateVisit.mutate(
                        { visitId: openF.id, staffId: st.id },
                        { onError: (e) => alert(e.message) },
                      )
                    }
                    style={chip(openF.staffId === st.id)}
                  >
                    {st.name}
                  </button>
                ))
              )}
            </div>
          </div>
          <span style={pill(vm.statusColor)}>{vm.statusLabel}</span>
          <button onClick={closeVisit} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 2 }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* checklist */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--dim)' }}>Checklist</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)' }}>
              {vm.resolvedT}/{vm.total} resolved
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {openF.tasks.map((t) => (
              <div
                key={t.id}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  borderRadius: 9,
                  padding: '11px 13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--text)', flex: 1 }}>{t.label}</div>
                  <button
                    type="button"
                    title="Remove task"
                    aria-label={`Remove ${t.label}`}
                    onClick={() => {
                      if (taskHasResult(t) && !confirm(`Remove "${t.label}"? It already has a recorded result.`)) return
                      removeTask.mutate({ taskId: t.id! }, { onError: (e) => alert(e.message) })
                    }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 2, flexShrink: 0 }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {SEGMENTS.map((seg) => {
                    const active = t.status === seg.value
                    return (
                      <button
                        key={seg.value}
                        type="button"
                        title={seg.title}
                        aria-label={`${t.label}: ${seg.title}`}
                        aria-pressed={active}
                        onClick={() =>
                          setStatus.mutate(
                            { taskId: t.id!, status: seg.value },
                            { onError: (e) => alert(e.message) },
                          )
                        }
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          borderRadius: 7,
                          border: `1px solid ${active ? seg.color : 'var(--border)'}`,
                          background: active ? seg.color : 'transparent',
                          color: active ? '#fff' : 'var(--dim)',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {seg.glyph}
                      </button>
                    )
                  })}
                </div>
                <input
                  defaultValue={t.remark}
                  aria-label={`${t.label} remark`}
                  placeholder="Add a remark…"
                  onBlur={(e) => {
                    const next = e.target.value
                    if (next !== t.remark)
                      setRemark.mutate(
                        { taskId: t.id!, remark: next },
                        { onError: (err) => alert(err.message) },
                      )
                  }}
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    borderRadius: 7,
                    padding: '8px 10px',
                    fontFamily: "'IBM Plex Sans'",
                    fontSize: 12.5,
                    color: 'var(--text)',
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
            <input
              value={newTaskLabel}
              onChange={(e) => setNewTaskLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                submitTask()
              }}
              placeholder="Add a task…"
              style={{
                flex: 1,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                borderRadius: 8,
                padding: '9px 12px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13,
                color: 'var(--text)',
              }}
            />
            <button
              type="button"
              onClick={submitTask}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                borderRadius: 8,
                padding: '9px 16px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            disabled={vm.pendingT === 0}
            onClick={() =>
              markAll.mutate({ visitId: openF.id }, { onSuccess: () => closeVisit(), onError: (e) => alert(e.message) })
            }
            style={{
              width: '100%',
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              borderRadius: 9,
              padding: 12,
              fontFamily: "'IBM Plex Sans'",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: vm.pendingT === 0 ? 'not-allowed' : 'pointer',
              opacity: vm.pendingT === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <Icon name="task_alt" size={18} />
            Mark pending as success
          </button>
          {vm.pendingT > 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--dim)', textAlign: 'center' }}>
              Sets the {vm.pendingT} pending {vm.pendingT === 1 ? 'task' : 'tasks'} to success · failed tasks are kept
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
