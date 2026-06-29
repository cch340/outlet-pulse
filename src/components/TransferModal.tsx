import type { CSSProperties } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { brandById, initials, outletById } from '../data/derived'
import { chip, tint } from '../theme'
import { Icon } from './Icon'
import { useTransferStaff } from '../data/queries/useStaffMutations'

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  marginBottom: 9,
}

const input: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  borderRadius: 8,
  padding: '10px 12px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13,
  color: 'var(--text)',
}

export function TransferModal() {
  const { state, closeTransfer, setTf } = useStore()
  const transfer = useTransferStaff()
  const { data } = useData()
  const S = state
  if (!S.transferStaffId || !S.transferForm) return null

  const st = data.staff.find((x) => x.id === S.transferStaffId)!
  const tf = S.transferForm
  const curB = brandById(data, st.brandId)
  const curO = outletById(data, st.outletId)
  const nb = brandById(data, tf.brandId)
  const no = outletById(data, tf.outletId)
  const ovPos = S.isMobile ? 'absolute' : 'fixed'

  return (
    <div
      onClick={closeTransfer}
      style={{ position: ovPos, inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 500,
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
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: tint('var(--accent)', 14),
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'IBM Plex Mono'",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {initials(st.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Transfer {st.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
              Currently {curB.name} · {curO.name}
            </div>
          </div>
          <button onClick={closeTransfer} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={fieldLabel}>New brand</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.brands.map((b) => (
                <button key={b.id} onClick={() => setTf('brandId', b.id)} style={chip(tf.brandId === b.id)}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color }} />
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={fieldLabel}>New outlet</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.outlets.map((o) => (
                <button key={o.id} onClick={() => setTf('outletId', o.id)} style={chip(tf.outletId === o.id)}>
                  {o.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={fieldLabel}>Effective date</div>
              <input type="date" value={tf.date} onChange={(e) => setTf('date', e.target.value)} style={input} />
            </div>
            <div style={{ flex: 2, minWidth: 180 }}>
              <div style={fieldLabel}>Reason (optional)</div>
              <input
                value={tf.reason}
                onChange={(e) => setTf('reason', e.target.value)}
                placeholder="e.g. New store opening"
                style={input}
              />
            </div>
          </div>
          <div
            style={{
              background: tint('var(--accent)', 8),
              border: `1px solid ${tint('var(--accent)', 25)}`,
              borderRadius: 9,
              padding: '12px 14px',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Icon name="swap_horiz" size={19} color="var(--accent)" />
            <span>
              <b>{st.name}</b> → {nb.name} at {no.name}
            </span>
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={closeTransfer}
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
            onClick={() => {
              transfer.mutate(
                { staffId: S.transferStaffId!, brandId: tf.brandId, outletId: tf.outletId, reason: tf.reason, date: tf.date },
                { onSuccess: () => closeTransfer() },
              )
            }}
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
            Confirm transfer
          </button>
        </div>
      </div>
    </div>
  )
}
