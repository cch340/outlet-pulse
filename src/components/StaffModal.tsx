import { useState } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { useCreateStaff, useUpdateStaff } from '../data/queries/useStaffCrudMutations'
import { useCorrectPosting } from '../data/queries/useStaffMutations'
import { planPostingCorrection } from '../data/queries/postingCorrection'
import { EntityModal, modalFieldLabel, modalInput } from './EntityModal'
import { chip } from '../theme'
import { isValidPhone } from '../data/whatsapp'
import { useToast } from './ToastProvider'
import { useConfirm } from './ConfirmProvider'

export function StaffModal() {
  const { state, closeStaffModal } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const { data } = useData()
  const m = state.staffModal
  const existing = m?.mode === 'edit' ? data.staff.find((s) => s.id === m.id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [role, setRole] = useState(existing?.role ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [phoneError, setPhoneError] = useState(false)
  const [joined, setJoined] = useState(existing?.joined ?? '')
  const [brandId, setBrandId] = useState(existing?.brandId ?? data.brands[0]?.id ?? '')
  const [outletId, setOutletId] = useState(existing?.outletId ?? data.outlets[0]?.id ?? '')

  const create = useCreateStaff()
  const update = useUpdateStaff()
  const correct = useCorrectPosting()
  if (!m) return null

  const submit = async () => {
    if (!name.trim() || !joined) return
    if (!isValidPhone(phone)) {
      setPhoneError(true)
      return
    }
    if (!brandId || !outletId) return
    if (m.mode === 'add') {
      create.mutate(
        { name: name.trim(), role: role.trim(), phone: phone.trim(), joined, brandId, outletId },
        {
          onSuccess: () => { closeStaffModal(); toast.success(`${name.trim()} added`) },
          onError: (e) => toast.error("Couldn't add staff: " + e.message),
        },
      )
      return
    }

    // Edit mode. Moving brand/outlet here is a data fix, not a transfer, so it
    // must not append a history entry — gate it behind an explicit confirm and
    // route it through useCorrectPosting rather than the transfer flow.
    const postingChanged =
      !!existing && (brandId !== existing.brandId || outletId !== existing.outletId)
    if (postingChanged) {
      const ok = await confirm({
        title: 'Correct posting?',
        message: 'This fixes the record in place without adding a transfer history entry.',
        confirmLabel: 'Correct posting',
      })
      if (!ok) return
    }
    update.mutate(
      { id: m.id, name: name.trim(), role: role.trim(), phone: phone.trim(), joined },
      {
        onSuccess: () => {
          if (postingChanged && existing) {
            const plan = planPostingCorrection(existing, brandId, outletId)
            correct.mutate(
              {
                staffId: m.id,
                brandId: plan.brandId,
                outletId: plan.outletId,
                currentHistoryRowUpdate: plan.currentHistoryRowUpdate,
              },
              {
                onSuccess: () => { closeStaffModal(); toast.success('Posting corrected.') },
                onError: (e) => toast.error("Couldn't correct posting: " + e.message),
              },
            )
          } else {
            closeStaffModal()
            toast.success('Staff updated')
          }
        },
        onError: (e) => toast.error("Couldn't update staff: " + e.message),
      },
    )
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
      <div>
        <div style={modalFieldLabel}>Phone</div>
        <input
          value={phone}
          onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(false) }}
          placeholder="e.g. 012-345 6789"
          style={{ ...modalInput, borderColor: phoneError ? '#dc2626' : 'var(--border)' }}
        />
        {phoneError && (
          <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 6 }}>Enter a valid phone number</div>
        )}
      </div>
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
        {m.mode === 'edit' && (
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.5 }}>
            Correcting the posting updates the record in place. Use Transfer for a real move — it keeps history.
          </div>
        )}
      </div>
    </EntityModal>
  )
}
