import { useStore, type ManageTab } from '../data/store'
import { tabBtn } from '../theme'
import { Brands } from './Brands'
import { Outlets } from './Outlets'
import { Staff } from './Staff'
import { TaskTemplatesPanel } from '../components/TaskTemplatesPanel'

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setManageTab(k)} style={tabBtn(tab === k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'brands' && <Brands />}
      {tab === 'outlets' && <Outlets />}
      {tab === 'staff' && <Staff />}
      {tab === 'tasks' && <TaskTemplatesPanel />}
    </div>
  )
}
