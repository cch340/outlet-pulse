import { useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useCreateBrand, useUpdateBrand } from '../data/queries/useBrandMutations'
import { EntityModal, modalFieldLabel, modalInput } from './EntityModal'

export function BrandModal() {
  const { state, closeBrandModal } = useStore()
  const { data } = useData()
  const m = state.brandModal
  const existing = m?.mode === 'edit' ? data.brands.find((b) => b.id === m.id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? '#0ea5e9')
  const [category, setCategory] = useState(existing?.category ?? '')

  const create = useCreateBrand()
  const update = useUpdateBrand()
  if (!m) return null

  const submit = () => {
    if (!name.trim()) return
    if (m.mode === 'add') {
      create.mutate(
        { name: name.trim(), color, category: category.trim(), sort: data.brands.length },
        { onSuccess: () => closeBrandModal(), onError: (e) => alert(e.message) },
      )
    } else {
      update.mutate(
        { id: m.id, name: name.trim(), color, category: category.trim() },
        { onSuccess: () => closeBrandModal(), onError: (e) => alert(e.message) },
      )
    }
  }

  return (
    <EntityModal
      title={m.mode === 'add' ? 'Add brand' : 'Edit brand'}
      onClose={closeBrandModal}
      onSubmit={submit}
      submitLabel={m.mode === 'add' ? 'Create' : 'Save'}
      isMobile={state.isMobile}
    >
      <div>
        <div style={modalFieldLabel}>Name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} style={modalInput} />
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={modalFieldLabel}>Category</div>
          <input value={category} onChange={(e) => setCategory(e.target.value)} style={modalInput} />
        </div>
        <div>
          <div style={modalFieldLabel}>Color</div>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ ...modalInput, padding: 4, width: 60 }} />
        </div>
      </div>
    </EntityModal>
  )
}
