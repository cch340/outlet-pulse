import { useStore, type ManageTab } from '../data/store'
import { chip } from '../theme'
import { Brands } from './Brands'
import { Outlets } from './Outlets'
import { Staff } from './Staff'

const TABS: [ManageTab, string][] = [
  ['brands', 'Brands'],
  ['outlets', 'Outlets'],
  ['staff', 'Staff'],
  ['tasks', 'Tasks'],
]

export function Manage() {
  const { state, setManageTab } = useStore()
  const tab = state.manageTab

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setManageTab(k)} style={chip(tab === k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'brands' && <Brands />}
      {tab === 'outlets' && <Outlets />}
      {tab === 'staff' && <Staff />}
      {tab === 'tasks' && (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
          Task library — coming up next.
        </div>
      )}
    </div>
  )
}
