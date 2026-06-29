import { StoreProvider, useStore } from './data/store'
import { useData } from './data/queries/useData'
import { useSession } from './auth/AuthProvider'
import { Login } from './screens/Login'
import { rootStyle, appShellStyle } from './theme'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './screens/Dashboard'
import { Brands } from './screens/Brands'
import { Outlets } from './screens/Outlets'
import { Staff } from './screens/Staff'
import { Visits } from './screens/Visits'
import { VisitDrawer } from './components/VisitDrawer'
import { TransferModal } from './components/TransferModal'
import { ScheduleModal } from './components/ScheduleModal'
import { BrandModal } from './components/BrandModal'
import { OutletModal } from './components/OutletModal'
import { StaffModal } from './components/StaffModal'

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
              {state.activeScreen === 'visits' && <Visits />}
            </div>
          </main>
          {isMobile && <BottomNav />}
        </div>

        <VisitDrawer />
        <TransferModal />
        <ScheduleModal />
        {state.brandModal && <BrandModal />}
        {state.outletModal && <OutletModal />}
        {state.staffModal && <StaffModal />}
      </div>
    </div>
  )
}

export function App() {
  const { session, loading } = useSession()

  if (loading) return <div style={{ padding: 40, fontFamily: "'IBM Plex Sans'" }}>Loading…</div>
  if (!session) return <Login />

  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
