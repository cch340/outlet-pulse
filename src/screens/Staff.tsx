import { useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useDeleteStaff } from '../data/queries/useStaffCrudMutations'
import { brandById, initials, outletById, tenure } from '../data/derived'
import { matchesQuery, compareBy } from '../data/listFilter'
import { actionBtn, card, chip, tint } from '../theme'
import { Icon } from '../components/Icon'
import { ListSearchInput, listSortSelectStyle } from '../components/ListSearchInput'
import { WhatsAppButton } from '../components/WhatsAppButton'
import { useToast } from '../components/ToastProvider'
import { useConfirm } from '../components/ConfirmProvider'

const transferredBadge = (label: string, small = false) => (
  <span
    style={{
      fontSize: small ? 9 : 9.5,
      fontWeight: 600,
      letterSpacing: '.03em',
      textTransform: 'uppercase',
      background: tint('#2563eb', 14),
      color: '#2563eb',
      borderRadius: 5,
      padding: '2px 6px',
    }}
  >
    {label}
  </span>
)

type StaffSort = 'name-asc' | 'name-desc' | 'tenure' | 'newest'

export function Staff() {
  const { state, setStaffBrandFilter, openTransfer, openStaffModal, openStaffDetail } = useStore()
  const del = useDeleteStaff()
  const toast = useToast()
  const confirm = useConfirm()
  const { data } = useData()
  const S = state
  const isMobile = S.isMobile
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<StaffSort>('name-asc')

  const removeStaff = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete staff member?',
      message: `${name} will be removed permanently.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    del.mutate(id, {
      onSuccess: () => toast.success(`${name} deleted`),
      onError: (e) => toast.error("Couldn't delete staff: " + e.message),
    })
  }

  const filters = [{ id: 'all', label: 'All staff' }, ...data.brands.map((b) => ({ id: b.id, label: b.name }))]

  // Chip filter first, then the free-text search composes on top of it.
  const list = data.staff.filter((s) => S.staffBrandFilter === 'all' || s.brandId === S.staffBrandFilter)

  const allRows = list.map((s) => {
    const b = brandById(data, s.brandId)
    const o = outletById(data, s.outletId)
    return {
      id: s.id,
      name: s.name,
      initials: initials(s.name),
      role: s.role,
      phone: s.phone,
      brandId: s.brandId,
      outletId: s.outletId,
      brandName: b.name,
      brandColor: b.color,
      outletName: o.name,
      joined: s.joined,
      tenure: tenure(s.joined),
      transferred: s.history.length > 1,
    }
  })

  const rows = allRows
    .filter((r) => matchesQuery(q, r.name, r.role, r.brandName, r.outletName))
    .sort(
      sort === 'name-asc'
        ? compareBy((r) => r.name, 'asc')
        : sort === 'name-desc'
          ? compareBy((r) => r.name, 'desc')
          : sort === 'tenure'
            ? compareBy((r) => r.joined, 'asc') // earliest join date = longest tenure
            : compareBy((r) => r.joined, 'desc'), // newest first
    )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {filters.map((f) => (
            <button key={f.id} onClick={() => setStaffBrandFilter(f.id)} style={chip(S.staffBrandFilter === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => openStaffModal({ mode: 'add' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
            color: 'var(--text)',
            borderRadius: 7,
            padding: '6px 11px',
            fontFamily: "'IBM Plex Sans'",
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Icon name="add" size={16} />
          Add staff
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <ListSearchInput value={q} onChange={setQ} placeholder="Search staff…" isMobile={isMobile} />
        <select
          aria-label="Sort staff"
          value={sort}
          onChange={(e) => setSort(e.target.value as StaffSort)}
          style={{ ...listSortSelectStyle, marginLeft: isMobile ? undefined : 'auto' }}
        >
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="tenure">Longest tenure</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {rows.length === 0 && (
        <div style={{ ...card, padding: '18px 16px', fontSize: 13, color: 'var(--dim)' }}>
          No staff match your search.
        </div>
      )}

      {rows.length > 0 && !isMobile && (
        <div style={{ ...card, overflowX: 'auto' }}>
          <div style={{ minWidth: 600 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                fontSize: 11,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: 'var(--dim)',
              }}
            >
              <div style={{ flex: 2.4, minWidth: 140 }}>Staff member</div>
              <div style={{ flex: 1.4, minWidth: 90 }}>Brand</div>
              <div style={{ flex: 1.4, minWidth: 90 }}>Outlet</div>
              <div style={{ flex: 1, minWidth: 70 }}>Tenure</div>
              <div style={{ width: 200, textAlign: 'right' }}>Action</div>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                onClick={() => openStaffDetail(r.id)}
                style={{ display: 'flex', alignItems: 'center', padding: 'var(--rowpad)', paddingLeft: 16, paddingRight: 16, borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <div style={{ flex: 2.4, minWidth: 140, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <Avatar initials={r.initials} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
                      {r.name}
                      {r.transferred && transferredBadge('Transferred')}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{r.role}</div>
                  </div>
                </div>
                <div style={{ flex: 1.4, minWidth: 90 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 500 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: r.brandColor }} />
                    {r.brandName}
                  </span>
                </div>
                <div style={{ flex: 1.4, minWidth: 90, fontSize: 12.5 }}>{r.outletName}</div>
                <div style={{ flex: 1, minWidth: 70, fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)' }}>{r.tenure}</div>
                <div style={{ width: 200, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <WhatsAppButton phone={r.phone} compact />
                  <button
                    onClick={(e) => { e.stopPropagation(); openStaffModal({ mode: 'edit', id: r.id }) }}
                    style={actionBtn()}
                  >
                    <Icon name="edit" size={16} />
                    Edit
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openTransfer(r.id, r.brandId, r.outletId) }} style={actionBtn()}>
                    <Icon name="swap_horiz" size={16} />
                    Transfer
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeStaff(r.id, r.name) }}
                    style={actionBtn({ danger: true })}
                  >
                    <Icon name="delete" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} onClick={() => openStaffDetail(r.id)} style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 11, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Avatar initials={r.initials} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {r.name}
                    {r.transferred && transferredBadge('Moved', true)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--dim)' }}>{r.role}</div>
                </div>
                <span style={{ color: 'var(--dim)', fontFamily: "'IBM Plex Mono'", fontSize: 12, flexShrink: 0 }}>{r.tenure}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  fontSize: 12.5,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: r.brandColor }} />
                  {r.brandName}
                </span>
                <span style={{ color: 'var(--dim)' }}>· {r.outletName}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <WhatsAppButton phone={r.phone} compact />
                <button
                  onClick={(e) => { e.stopPropagation(); openStaffModal({ mode: 'edit', id: r.id }) }}
                  style={{ ...actionBtn(), marginLeft: 'auto' }}
                >
                  <Icon name="edit" size={16} />
                </button>
                <button onClick={() => openTransfer(r.id, r.brandId, r.outletId)} style={actionBtn()}>
                  <Icon name="swap_horiz" size={16} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeStaff(r.id, r.name) }}
                  style={actionBtn({ danger: true })}
                >
                  <Icon name="delete" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Avatar({ initials, size }: { initials: string; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: tint('var(--accent)', 14),
        color: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'IBM Plex Mono'",
        fontSize: 12,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}
