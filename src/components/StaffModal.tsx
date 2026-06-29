import { useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useCreateStaff, useUpdateStaff } from '../data/queries/useStaffCrudMutations'
import { EntityModal, modalFieldLabel, modalInput } from './EntityModal'
import { chip } from '../theme'

export function StaffModal() {
  const { state, closeStaffModal } = useStore()
  const { data } = useData()
  const m = state.staffModal
  const existing = m?.mode === 'edit' ? data.staff.find((s) => s.id === m.id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [role, setRole] = useState(existing?.role ?? '')
  const [joined, setJoined] = useState(existing?.joined ?? '')
  const [brandId, setBrandId] = useState(existing?.brandId ?? data.brands[0]?.id ?? '')
  const [outletId, setOutletId] = useState(existing?.outletId ?? data.outlets[0]?.id ?? '')

  const create = useCreateStaff()
  const update = useUpdateStaff()
  if (!m) return null

  const submit = () => {
    if (!name.trim() || !joined) return
    if (m.mode === 'add') {
      if (!brandId || !outletId) return
      create.mutate(
        { name: name.trim(), role: role.trim(), joined, brandId, outletId },
        { onSuccess: () => closeStaffModal(), onError: (e) => alert(e.message) },
      )
    } else {
      update.mutate(
        { id: m.id, name: name.trim(), role: role.trim(), joined },
        { onSuccess: () => closeStaffModal(), onError: (e) => alert(e.message) },
      )
    }
  }

  return (
    <EntityModal
      title={m.mode === 'add' ? 'Add staff' : 'Edit staff'}
      onClose={closeStaffModal}
      onSubmit={submit}
      submitLabel={m.mode === 'add' ? 'Create' : 'Save'}
      isMobile={state.isMobile}
    >
      <div>
        <div style={modalFieldLabel}>Name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} style={modalInput} />
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={modalFieldLabel}>Role</div>
          <input value={role} onChange={(e) => setRole(e.target.value)} style={modalInput} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={modalFieldLabel}>Joined</div>
          <input type="date" value={joined} onChange={(e) => setJoined(e.target.value)} style={modalInput} />
        </div>
      </div>
      {m.mode === 'add' && (
        <>
          <div>
            <div style={modalFieldLabel}>Brand</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.brands.map((b) => (
                <button key={b.id} onClick={() => setBrandId(b.id)} style={chip(brandId === b.id)}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color }} />
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={modalFieldLabel}>Outlet</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.outlets.map((o) => (
                <button key={o.id} onClick={() => setOutletId(o.id)} style={chip(outletId === o.id)}>
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </EntityModal>
  )
}
