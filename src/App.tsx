import { lazy, Suspense } from 'react'
import { StoreProvider, useStore } from './data/store'
import { ToastProvider } from './components/ToastProvider'
import { ConfirmProvider } from './components/ConfirmProvider'
import { useData } from './data/queries/useData'
import { useAutoGenerateVisits } from './data/queries/useAutoGenerateVisits'
import { useSession } from './auth/AuthProvider'
import { Login } from './screens/Login'
import { rootStyle, appShellStyle } from './theme'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { BottomNav } from './components/BottomNav'

// Route-level code splitting: each screen loads as its own chunk on first view.
const Dashboard = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.Dashboard })))
const Stores = lazy(() => import('./screens/Stores').then((m) => ({ default: m.Stores })))
const Visits = lazy(() => import('./screens/Visits').then((m) => ({ default: m.Visits })))
const Manage = lazy(() => import('./screens/Manage').then((m) => ({ default: m.Manage })))
import { StoreVisitsDrawer } from './components/StoreVisitsDrawer'
import { VisitDrawer } from './components/VisitDrawer'
import { TransferModal } from './components/TransferModal'
import { ScheduleModal } from './components/ScheduleModal'
import { BrandModal } from './components/BrandModal'
import { OutletModal } from './components/OutletModal'
import { StaffModal } from './components/StaffModal'
import { BrandDetailModal } from './components/BrandDetailModal'
import { OutletDetailModal } from './components/OutletDetailModal'
import { StaffDetailModal } from './components/StaffDetailModal'
import { SettingsModal } from './components/SettingsModal'

function Shell() {
  const { state } = useStore()
  const { isLoading, isError } = useData()
  const isMobile = state.isMobile
  useAutoGenerateVisits()

  if (isLoading) return <div style={{ padding: 40 }}>Loading…</div>
  if (isError) return <div style={{ padding: 40 }}>Failed to load data. Check your Supabase connection.</div>

  return (
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
            {/* Keyed by activeScreen so the fadein re-runs each screen switch. */}
            <div key={state.activeScreen} style={{ maxWidth: 1300, margin: '0 auto', animation: 'fadein var(--motion-dur) var(--motion-ease)' }}>
              <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}>
                {state.activeScreen === 'dashboard' && <Dashboard />}
                {state.activeScreen === 'stores' && <Stores />}
                {state.activeScreen === 'visits' && <Visits />}
                {state.activeScreen === 'manage' && <Manage />}
              </Suspense>
            </div>
          </main>
          {isMobile && <BottomNav />}
        </div>

        {state.storeVisits && <StoreVisitsDrawer />}
        <VisitDrawer key={state.openVisitId} />
        <TransferModal />
        <ScheduleModal />
        {state.brandModal && <BrandModal />}
        {state.outletModal && <OutletModal />}
        {state.staffModal && <StaffModal />}
        {state.brandDetailId && <BrandDetailModal />}
        {state.outletDetailId && <OutletDetailModal />}
        {state.staffDetailId && <StaffDetailModal />}
        {state.settingsOpen && <SettingsModal />}
    </div>
  )
}

/**
 * Wraps the app UI in the themed `rootStyle` root so the CSS variables + app font
 * apply to everything inside — crucially including the Toast/Confirm provider overlays,
 * which render alongside Shell. Must live inside StoreProvider to read `state`.
 */
function ThemedRoot() {
  const { state } = useStore()
  return (
    <div style={rootStyle(state)}>
      <ToastProvider>
        <ConfirmProvider>
          <Shell />
        </ConfirmProvider>
      </ToastProvider>
    </div>
  )
}

export function App() {
  const { session, loading } = useSession()

  if (loading) return <div style={{ padding: 40, fontFamily: "'IBM Plex Sans'" }}>Loading…</div>
  if (!session) return <Login />

  return (
    <StoreProvider>
      <ThemedRoot />
    </StoreProvider>
  )
}
