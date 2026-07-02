import { useStore, type ManageTab } from '../data/store'
import { tabBtn } from '../theme'
import { Brands } from './Brands'
import { Outlets } from './Outlets'
import { Staff } from './Staff'
import { TaskTemplatesPanel } from '../components/TaskTemplatesPanel'
import { StoresPanel } from '../components/StoresPanel'

const TABS: [ManageTab, string][] = [
  ['brands', 'Brands'],
  ['outlets', 'Outlets'],
  ['stores', 'Stores'],
  ['staff', 'Staff'],
  ['tasks', 'Tasks'],
]

export function Manage() {
  const { state, setManageTab } = useStore()
  const tab = state.manageTab

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setManageTab(k)} style={tabBtn(tab === k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'brands' && <Brands />}
      {tab === 'outlets' && <Outlets />}
      {tab === 'stores' && <StoresPanel />}
      {tab === 'staff' && <Staff />}
      {tab === 'tasks' && <TaskTemplatesPanel />}
    </div>
  )
}
