import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { actionBtn, card } from '../theme'
import { Icon } from '../components/Icon'
import { useToast } from '../components/ToastProvider'
import { useConfirm } from '../components/ConfirmProvider'
import { useDeleteBrand, useReorderBrands } from '../data/queries/useBrandMutations'

export function Brands() {
  const { state, openBrandDetail, openBrandModal } = useStore()
  const { data } = useData()
  const del = useDeleteBrand()
  const reorderB = useReorderBrands()
  const toast = useToast()
  const confirm = useConfirm()
  const isMobile = state.isMobile
  const ids = data.brands.map((b) => b.id)
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    const next = ids.slice()
    ;[next[index], next[j]] = [next[j], next[index]]
    reorderB.mutate({ ids: next }, { onError: (e) => toast.error("Couldn't reorder brands: " + e.message) })
  }

  const rows = data.brands.map((b) => ({
    id: b.id,
    name: b.name,
    color: b.color,
    category: b.category,
    outletCount: data.stores.filter((s) => s.brandId === b.id).length,
    staffCount: data.staff.filter((s) => s.brandId === b.id).length,
  }))

  const del1 = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete brand?',
      message: `${name} will be removed permanently.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    del.mutate(id, {
      onSuccess: () => toast.success(`${name} deleted`),
      onError: () => toast.error("Couldn't delete brand: it still has staff or store links."),
    })
  }

  const Logo = ({ name, color, size }: { name: string; color: string; size: number }) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: size < 40 ? 14 : 15,
        flexShrink: 0,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--dim)' }}>
          All brands
        </div>
        <button onClick={() => openBrandModal({ mode: 'add' })} style={actionBtn()}>
          <Icon name="add" size={16} />
          Add brand
        </button>
      </div>

      {!isMobile && (
        <div style={{ ...card, overflowX: 'auto' }}>
          <div style={{ minWidth: 640 }}>
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
              <div style={{ flex: 2.4, minWidth: 160 }}>Brand</div>
              <div style={{ flex: 1, minWidth: 80 }}>Outlets</div>
              <div style={{ flex: 1, minWidth: 80 }}>Staff</div>
              <div style={{ width: 300, textAlign: 'right' }}>Action</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.id}
                style={{ display: 'flex', alignItems: 'center', padding: 'var(--rowpad)', paddingLeft: 16, paddingRight: 16, borderBottom: '1px solid var(--border)' }}
              >
                <div style={{ flex: 2.4, minWidth: 160, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <Logo name={r.name} color={r.color} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{r.category}</div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 80, fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600 }}>{r.outletCount}</div>
                <div style={{ flex: 1, minWidth: 80, fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600 }}>{r.staffCount}</div>
                <div style={{ width: 300, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" style={{ ...actionBtn(), cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1 }}>
                    <Icon name="arrow_upward" size={16} />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === ids.length - 1} title="Move down" style={{ ...actionBtn(), cursor: i === ids.length - 1 ? 'default' : 'pointer', opacity: i === ids.length - 1 ? 0.3 : 1 }}>
                    <Icon name="arrow_downward" size={16} />
                  </button>
                  <button onClick={() => openBrandDetail(r.id)} style={actionBtn()}>
                    <Icon name="visibility" size={16} />
                    Detail
                  </button>
                  <button onClick={() => openBrandModal({ mode: 'edit', id: r.id })} style={actionBtn()}>
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

      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => (
            <div key={r.id} style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Logo name={r.name} color={r.color} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--dim)' }}>{r.category}</div>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)', flexShrink: 0 }}>
                  {r.outletCount} outlets · {r.staffCount} staff
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" style={{ ...actionBtn(), cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1 }}>
                  <Icon name="arrow_upward" size={16} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === ids.length - 1} title="Move down" style={{ ...actionBtn(), cursor: i === ids.length - 1 ? 'default' : 'pointer', opacity: i === ids.length - 1 ? 0.3 : 1 }}>
                  <Icon name="arrow_downward" size={16} />
                </button>
                <button onClick={() => openBrandDetail(r.id)} title="Detail" style={{ ...actionBtn(), marginLeft: 'auto' }}>
                  <Icon name="visibility" size={16} />
                </button>
                <button onClick={() => openBrandModal({ mode: 'edit', id: r.id })} style={actionBtn()}>
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
