import { useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { actionBtn, card, tint } from '../theme'
import { Icon } from '../components/Icon'
import { ListSearchInput, listSortSelectStyle } from '../components/ListSearchInput'
import { matchesQuery, compareBy } from '../data/listFilter'
import { useToast } from '../components/ToastProvider'
import { useConfirm } from '../components/ConfirmProvider'
import { useDeleteOutlet } from '../data/queries/useOutletMutations'

type OutletSort = 'name-asc' | 'name-desc' | 'brands' | 'staff'

export function Outlets() {
  const { state, openOutletDetail, openOutletModal } = useStore()
  const { data } = useData()
  const del = useDeleteOutlet()
  const toast = useToast()
  const confirm = useConfirm()
  const isMobile = state.isMobile
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<OutletSort>('name-asc')

  const allRows = data.outlets.map((o) => ({
    id: o.id,
    name: o.name,
    location: o.location,
    brandCount: data.stores.filter((s) => s.outletId === o.id).length,
    staffCount: data.staff.filter((s) => s.outletId === o.id).length,
  }))

  const rows = allRows
    .filter((r) => matchesQuery(q, r.name, r.location))
    .sort(
      sort === 'name-asc'
        ? compareBy((r) => r.name, 'asc')
        : sort === 'name-desc'
          ? compareBy((r) => r.name, 'desc')
          : sort === 'brands'
            ? compareBy((r) => r.brandCount, 'desc')
            : compareBy((r) => r.staffCount, 'desc'),
    )

  const del1 = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete outlet?',
      message: `${name} will be removed permanently.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    del.mutate(id, {
      onSuccess: () => toast.success(`${name} deleted`),
      onError: () => toast.error("Couldn't delete outlet: it still has staff or store links."),
    })
  }

  const OutletIcon = ({ size }: { size: number }) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: tint('var(--accent)', 13),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name="storefront" size={size < 40 ? 20 : 22} color="var(--accent)" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--dim)' }}>
          All outlets
        </div>
        <button onClick={() => openOutletModal({ mode: 'add' })} style={actionBtn()}>
          <Icon name="add" size={16} />
          Add outlet
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <ListSearchInput value={q} onChange={setQ} placeholder="Search outlets…" isMobile={isMobile} />
        <select
          aria-label="Sort outlets"
          value={sort}
          onChange={(e) => setSort(e.target.value as OutletSort)}
          style={{ ...listSortSelectStyle, marginLeft: isMobile ? undefined : 'auto' }}
        >
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="brands">Brands</option>
          <option value="staff">Staff</option>
        </select>
      </div>

      {rows.length === 0 && (
        <div style={{ ...card, padding: '18px 16px', fontSize: 13, color: 'var(--dim)' }}>
          No outlets match your search.
        </div>
      )}

      {rows.length > 0 && !isMobile && (
        <div style={{ ...card, overflowX: 'auto' }}>
          <div style={{ minWidth: 560 }}>
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
              <div style={{ flex: 2.4, minWidth: 160 }}>Outlet</div>
              <div style={{ flex: 1, minWidth: 80 }}>Brands</div>
              <div style={{ flex: 1, minWidth: 80 }}>Staff</div>
              <div style={{ width: 230, textAlign: 'right' }}>Action</div>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{ display: 'flex', alignItems: 'center', padding: 'var(--rowpad)', paddingLeft: 16, paddingRight: 16, borderBottom: '1px solid var(--border)' }}
              >
                <div style={{ flex: 2.4, minWidth: 160, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <OutletIcon size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{r.location}</div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 80, fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600 }}>{r.brandCount}</div>
                <div style={{ flex: 1, minWidth: 80, fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600 }}>{r.staffCount}</div>
                <div style={{ width: 230, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button onClick={() => openOutletDetail(r.id)} style={actionBtn()}>
                    <Icon name="visibility" size={16} />
                    Detail
                  </button>
                  <button onClick={() => openOutletModal({ mode: 'edit', id: r.id })} style={actionBtn()}>
                    <Icon name="edit" size={16} />
                    Edit
                  </button>
                  <button onClick={() => del1(r.id, r.name)} title="Delete" style={actionBtn({ danger: true })}>
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
            <div key={r.id} style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <OutletIcon size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--dim)' }}>{r.location}</div>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)', flexShrink: 0 }}>
                  {r.brandCount} brands · {r.staffCount} staff
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => openOutletDetail(r.id)} title="Detail" style={{ ...actionBtn(), marginLeft: 'auto' }}>
                  <Icon name="visibility" size={16} />
                </button>
                <button onClick={() => openOutletModal({ mode: 'edit', id: r.id })} style={actionBtn()}>
                  <Icon name="edit" size={16} />
                </button>
                <button onClick={() => del1(r.id, r.name)} title="Delete" style={actionBtn({ danger: true })}>
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
