import { useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useCreateOutlet, useUpdateOutlet } from '../data/queries/useOutletMutations'
import { EntityModal, modalFieldLabel, modalInput } from './EntityModal'

export function OutletModal() {
  const { state, closeOutletModal } = useStore()
  const { data } = useData()
  const m = state.outletModal
  const existing = m?.mode === 'edit' ? data.outlets.find((o) => o.id === m.id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [location, setLocation] = useState(existing?.location ?? '')

  const create = useCreateOutlet()
  const update = useUpdateOutlet()
  if (!m) return null

  const submit = () => {
    if (!name.trim()) return
    if (m.mode === 'add') {
      create.mutate({ name: name.trim(), location: location.trim() }, { onSuccess: () => closeOutletModal(), onError: (e) => alert(e.message) })
    } else {
      update.mutate({ id: m.id, name: name.trim(), location: location.trim() }, { onSuccess: () => closeOutletModal(), onError: (e) => alert(e.message) })
    }
  }

  return (
    <EntityModal
      title={m.mode === 'add' ? 'Add outlet' : 'Edit outlet'}
      onClose={closeOutletModal}
      onSubmit={submit}
      submitLabel={m.mode === 'add' ? 'Create' : 'Save'}
      isMobile={state.isMobile}
    >
      <div>
        <div style={modalFieldLabel}>Name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} style={modalInput} />
      </div>
      <div>
        <div style={modalFieldLabel}>Location</div>
        <input value={location} onChange={(e) => setLocation(e.target.value)} style={modalInput} />
      </div>
    </EntityModal>
  )
}
