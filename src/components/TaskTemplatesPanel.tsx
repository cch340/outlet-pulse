import { useState } from 'react'
import { useData } from '../data/queries/useData'
import { card } from '../theme'
import { Icon } from './Icon'
import { AddTaskToVisitsModal } from './AddTaskToVisitsModal'
import {
  useCreateTaskTemplate,
  useRenameTaskTemplate,
  useDeleteTaskTemplate,
  useReorderTaskTemplates,
} from '../data/queries/useTaskTemplateMutations'

export function TaskTemplatesPanel() {
  const { data } = useData()
  const createT = useCreateTaskTemplate()
  const renameT = useRenameTaskTemplate()
  const deleteT = useDeleteTaskTemplate()
  const reorderT = useReorderTaskTemplates()
  const [newLabel, setNewLabel] = useState('')
  const [addToVisitsLabel, setAddToVisitsLabel] = useState<string | null>(null)

  const templates = data.taskTemplates
  const ids = templates.map((t) => t.id)

  const add = () => {
    const label = newLabel.trim()
    if (!label) return
    createT.mutate({ label, sort: templates.length }, { onError: (e) => alert(e.message) })
    setNewLabel('')
  }

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    const next = ids.slice()
    ;[next[index], next[j]] = [next[j], next[index]]
    reorderT.mutate({ ids: next }, { onError: (e) => alert(e.message) })
  }

  const inputStyle = {
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    borderRadius: 8,
    padding: '9px 12px',
    fontFamily: "'IBM Plex Sans'",
    fontSize: 13,
    color: 'var(--text)',
  } as const
  const iconBtn = {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--dim)',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
  } as const

  return (
    <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Visit tasks</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>
          Reusable checks shown (all ticked) when scheduling a visit.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="New task…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={add}
          style={{
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {templates.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--dim)', padding: '4px 2px' }}>
            No tasks yet. Add your first reusable check above.
          </div>
        )}
        {templates.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              borderRadius: 9,
              padding: '8px 10px 8px 12px',
            }}
          >
            <input
              defaultValue={t.label}
              onBlur={(e) => {
                const label = e.target.value.trim()
                if (label && label !== t.label) renameT.mutate({ id: t.id, label }, { onError: (err) => alert(err.message) })
                else e.target.value = t.label
              }}
              style={{ ...inputStyle, flex: 1, background: 'transparent', border: '1px solid transparent' }}
            />
            <button
              onClick={() => setAddToVisitsLabel(t.label)}
              title="Add to existing visits"
              style={iconBtn}
            >
              <Icon name="add_task" size={18} />
            </button>
            <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" style={{ ...iconBtn, opacity: i === 0 ? 0.3 : 1 }}>
              <Icon name="arrow_upward" size={18} />
            </button>
            <button onClick={() => move(i, 1)} disabled={i === templates.length - 1} title="Move down" style={{ ...iconBtn, opacity: i === templates.length - 1 ? 0.3 : 1 }}>
              <Icon name="arrow_downward" size={18} />
            </button>
            <button
              onClick={() => deleteT.mutate({ id: t.id }, { onError: (err) => alert(err.message) })}
              title="Delete"
              style={{ ...iconBtn, color: '#dc2626' }}
            >
              <Icon name="delete" size={18} />
            </button>
          </div>
        ))}
      </div>

      {addToVisitsLabel !== null && (
        <AddTaskToVisitsModal label={addToVisitsLabel} onClose={() => setAddToVisitsLabel(null)} />
      )}
    </div>
  )
}
