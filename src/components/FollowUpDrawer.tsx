import { useStore } from '../data/store'
import { fuVM } from '../data/derived'
import { pill } from '../theme'
import { Icon } from './Icon'

export function FollowUpDrawer() {
  const { state, closeFu, toggleTask, markDone, toggleStatus } = useStore()
  const S = state
  const openF = S.openFuId ? S.followups.find((f) => f.id === S.openFuId) : null
  if (!openF) return null

  const vm = fuVM(S, openF)
  const ovPos = S.isMobile ? 'absolute' : 'fixed'

  return (
    <div
      onClick={closeFu}
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
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600, marginBottom: 5 }}>
              Follow-up · {vm.dateLabel}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: vm.brandColor }} />
              {vm.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4 }}>Staff on duty · {vm.staffName}</div>
          </div>
          <span style={pill(vm.statusColor)}>{vm.statusLabel}</span>
          <button onClick={closeFu} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 2 }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* checklist */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--dim)' }}>Checklist</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)' }}>
              {vm.doneT}/{vm.total} complete
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {openF.tasks.map((t, i) => (
              <button
                key={i}
                onClick={() => toggleTask(openF.id, i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  borderRadius: 9,
                  padding: '11px 13px',
                  cursor: 'pointer',
                }}
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
                    border: `1.5px solid ${t.done ? '#16a34a' : 'var(--border)'}`,
                    background: t.done ? '#16a34a' : 'transparent',
                  }}
                >
                  {t.done && <Icon name="check" size={15} color="#fff" />}
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    color: t.done ? 'var(--dim)' : 'var(--text)',
                    textDecoration: t.done ? 'line-through' : 'none',
                  }}
                >
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          {openF.status === 'done' ? (
            <button
              onClick={() => toggleStatus(openF.id)}
              style={{
                flex: 1,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                borderRadius: 9,
                padding: 12,
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reopen follow-up
            </button>
          ) : (
            <button
              onClick={() => markDone(openF.id)}
              style={{
                flex: 1,
                border: 'none',
                background: '#16a34a',
                color: '#fff',
                borderRadius: 9,
                padding: 12,
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
              }}
            >
              <Icon name="task_alt" size={18} />
              Mark complete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
