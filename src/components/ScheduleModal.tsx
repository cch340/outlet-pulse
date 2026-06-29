import { useEffect, useState, type CSSProperties } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { brandById, outletById } from '../data/derived'
import { chip } from '../theme'
import { Icon } from './Icon'
import { useCreateVisit } from '../data/queries/useVisitMutations'
import { useCreateTaskTemplate } from '../data/queries/useTaskTemplateMutations'
import { itemsFromTemplates, planSchedule, type ScheduleTaskItem } from '../data/queries/scheduleTasks'

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  marginBottom: 9,
}

const FULL_WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const weekdayOf = (iso: string) => (iso ? FULL_WD[new Date(iso + 'T00:00:00').getDay()] : '')

export function ScheduleModal() {
  const { state, closeAdd, setAf } = useStore()
  const create = useCreateVisit()
  const createTemplate = useCreateTaskTemplate()
  const { data } = useData()
  const [newLabel, setNewLabel] = useState('')
  const S = state

  // Seed the checklist from the saved templates (all ticked) each time the modal opens.
  useEffect(() => {
    if (S.addOpen) setAf('tasks', itemsFromTemplates(data.taskTemplates))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.addOpen])

  if (!S.addOpen || !S.addForm) return null

  const af = S.addForm
  const items = af.tasks
  const selN = items.filter((t) => t.checked).length
  const [sb, so] = af.storeKey.split('|')
  const bName = brandById(data, sb)?.name ?? '—'
  const oName = outletById(data, so)?.name ?? '—'
  const summary = `${bName} · ${oName} · ${selN} tasks`
  const ovPos = S.isMobile ? 'absolute' : 'fixed'
  const dayName = weekdayOf(af.date)

  const setItems = (next: ScheduleTaskItem[]) => setAf('tasks', next)
  const toggle = (key: string) =>
    setItems(items.map((t) => (t.key === key ? { ...t, checked: !t.checked } : t)))
  const toggleSave = (key: string) =>
    setItems(items.map((t) => (t.key === key ? { ...t, saveAsTemplate: !t.saveAsTemplate } : t)))
  const remove = (key: string) => setItems(items.filter((t) => t.key !== key))
  const addItem = () => {
    const label = newLabel.trim()
    if (!label) return
    const key = `new-${label.toLowerCase()}-${items.length}`
    setItems([...items, { key, label, checked: true, saveAsTemplate: false }])
    setNewLabel('')
  }

  const submit = () => {
    const [b, o] = af.storeKey.split('|')
    if (!b || !o) return
    const plan = planSchedule(items, data.taskTemplates)
    create.mutate(
      { brandId: b, outletId: o, staffId: af.staffId || null, date: af.date, taskLabels: plan.taskLabels },
      {
        onSuccess: () => {
          plan.newTemplateLabels.forEach((label, i) =>
            createTemplate.mutate({ label, sort: data.taskTemplates.length + i }),
          )
          closeAdd()
        },
        onError: (e) => alert(e.message),
      },
    )
  }

  return (
    <div
      onClick={closeAdd}
      style={{ position: ovPos, inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: '100%',
          maxHeight: '92vh',
          overflow: 'auto',
          background: 'var(--surface)',
          borderRadius: 14,
          boxShadow: '0 30px 80px rgba(0,0,0,.3)',
          animation: 'pop .18s ease',
        }}
      >
        {/* header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Schedule a visit</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>Plan a store visit and the checks to perform</div>
          </div>
          <button onClick={closeAdd} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={fieldLabel}>Store (brand · outlet)</div>
            {data.stores.length === 0 && (
              <div
                style={{
                  border: '1px dashed var(--border)',
                  borderRadius: 9,
                  padding: '12px 14px',
                  fontSize: 13,
                  color: 'var(--dim)',
                  lineHeight: 1.5,
                }}
              >
                No stores yet. A store is a brand linked to an outlet — go to{' '}
                <strong style={{ color: 'var(--text)' }}>Manage → Brands</strong>, edit a brand, and tick the
                outlet it operates in under <strong style={{ color: 'var(--text)' }}>Operates in outlets</strong>.
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.stores.map((s) => {
                const b = brandById(data, s.brandId)
                const o = outletById(data, s.outletId)
                const key = `${s.brandId}|${s.outletId}`
                return (
                  <button key={key} onClick={() => setAf('storeKey', key)} style={chip(af.storeKey === key)}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                    {b.name} · {o.name}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={fieldLabel}>Scheduled date</div>
              <input
                type="date"
                value={af.date}
                onChange={(e) => setAf('date', e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontFamily: "'IBM Plex Sans'",
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              />
              {dayName && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 6 }}>{dayName}</div>}
            </div>
          </div>
          <div>
            <div style={fieldLabel}>Tasks to check</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((t) => (
                <div
                  key={t.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    borderRadius: 9,
                    padding: '10px 13px',
                  }}
                >
                  <button
                    onClick={() => toggle(t.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1.5px solid ${t.checked ? 'var(--accent)' : 'var(--border)'}`,
                        background: t.checked ? 'var(--accent)' : 'transparent',
                      }}
                    >
                      {t.checked && <Icon name="check" size={15} color="#fff" />}
                    </span>
                    <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{t.label}</span>
                  </button>
                  {!t.templateId && (
                    <button
                      onClick={() => toggleSave(t.key)}
                      title={t.saveAsTemplate ? 'Will be saved for future visits' : 'Save for future use'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: t.saveAsTemplate ? 'var(--accent)' : 'var(--dim)',
                      }}
                    >
                      <Icon name={t.saveAsTemplate ? 'bookmark_added' : 'bookmark_add'} size={17} />
                      Save
                    </button>
                  )}
                  <button onClick={() => remove(t.key)} title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 2 }}>
                    <Icon name="close" size={18} />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--dim)', padding: '2px 2px' }}>
                  No tasks yet — add one below, or create reusable tasks in Manage → Tasks.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addItem()
                    }
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
                  onClick={addItem}
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
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>{summary}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={closeAdd}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                borderRadius: 9,
                padding: '10px 18px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              style={{
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 9,
                padding: '10px 18px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
