import { StoreProvider, useStore } from './data/store'
import { useData } from './data/queries/useData'
import { rootStyle, appShellStyle } from './theme'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './screens/Dashboard'
import { Brands } from './screens/Brands'
import { Outlets } from './screens/Outlets'
import { Staff } from './screens/Staff'
import { Followups } from './screens/Followups'
import { FollowUpDrawer } from './components/FollowUpDrawer'
import { TransferModal } from './components/TransferModal'
import { ScheduleModal } from './components/ScheduleModal'

function Shell() {
  const { state } = useStore()
  const { isLoading, isError } = useData()
  const isMobile = state.isMobile

  if (isLoading) return <div style={{ padding: 40 }}>Loading…</div>
  if (isError) return <div style={{ padding: 40 }}>Failed to load data. Check your Supabase connection.</div>

  return (
    <div style={rootStyle(state)}>
      <div style={appShellStyle(isMobile)}>
        {!isMobile && <Sidebar />}

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            background: 'var(--bg)',
          }}
        >
          <TopBar />
          <main style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'var(--pad)' }}>
            <div style={{ maxWidth: 1300, margin: '0 auto' }}>
              {state.activeScreen === 'dashboard' && <Dashboard />}
              {state.activeScreen === 'brands' && <Brands />}
              {state.activeScreen === 'outlets' && <Outlets />}
              {state.activeScreen === 'staff' && <Staff />}
              {state.activeScreen === 'followups' && <Followups />}
            </div>
          </main>
          {isMobile && <BottomNav />}
        </div>

        <FollowUpDrawer />
        <TransferModal />
        <ScheduleModal />
      </div>
    </div>
  )
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
