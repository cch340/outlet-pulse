import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { brandById, outletById, staffById, fmt, today, localDateStr } from '../data/derived'
import { nextOccurrence } from '../data/recurrence'
import { actionBtn, card } from '../theme'
import { Icon } from './Icon'
import { useToast } from './ToastProvider'
import { useConfirm } from './ConfirmProvider'
import {
  useSetRecurringActive,
  useDeleteRecurringSchedule,
} from '../data/queries/useRecurringMutations'

const FREQ_LABEL: Record<'weekly' | 'monthly', string> = { weekly: 'Weekly', monthly: 'Monthly' }

export function RecurringPanel() {
  const { state } = useStore()
  const isMobile = state.isMobile
  const { data } = useData()
  const toast = useToast()
  const confirm = useConfirm()
  const setActive = useSetRecurringActive()
  const del = useDeleteRecurringSchedule()

  const todayISO = localDateStr(today())
  const schedules = data.recurringSchedules

  const toggle = (id: string, active: boolean, label: string) => {
    setActive.mutate(
      { id, active: !active },
      {
        onSuccess: () => toast.success(active ? `${label} paused` : `${label} resumed`),
        onError: (e) => toast.error("Couldn't update schedule: " + e.message),
      },
    )
  }

  const remove = async (id: string, label: string) => {
    const ok = await confirm({
      title: 'Delete recurring schedule?',
      message: `${label} will stop auto-creating visits. Visits already created are kept.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    del.mutate(
      { id },
      {
        onSuccess: () => toast.success(`${label} deleted`),
        onError: (e) => toast.error("Couldn't delete schedule: " + e.message),
      },
    )
  }

  return (
    <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Recurring schedules</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>
          Visits auto-created on a weekly or monthly cadence when they come due.
        </div>
      </div>

      {schedules.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--dim)', padding: '4px 2px' }}>
          No recurring schedules. Create one from Schedule → Repeat.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {schedules.map((s) => {
          const b = brandById(data, s.brandId)
          const o = outletById(data, s.outletId)
          const staffName = s.staffId ? staffById(data, s.staffId).name : 'Unassigned'
          const label = `${b.name} · ${o.name}`
          const next = nextOccurrence(s, todayISO)
          return (
            <div
              key={s.id}
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                gap: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                borderRadius: 9,
                padding: isMobile ? '12px' : '10px 12px',
                opacity: s.active ? 1 : 0.62,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '.02em',
                      color: s.active ? 'var(--accent)' : 'var(--dim)',
                      border: `1px solid ${s.active ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 6,
                      padding: '2px 7px',
                    }}
                  >
                    {s.active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4 }}>
                  {FREQ_LABEL[s.frequency]} · {staffName} · from {fmt(s.startDate)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>
                  {s.active && next ? `Next due: ${fmt(next)}` : 'Paused — no upcoming visits'}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                  ...(isMobile ? { paddingTop: 10, borderTop: '1px solid var(--border)' } : {}),
                }}
              >
                <button onClick={() => toggle(s.id, s.active, label)} style={actionBtn()}>
                  <Icon name={s.active ? 'pause' : 'play_arrow'} size={16} />
                  {s.active ? 'Pause' : 'Resume'}
                </button>
                <button onClick={() => remove(s.id, label)} title="Delete" style={actionBtn({ danger: true })}>
                  <Icon name="delete" size={16} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
