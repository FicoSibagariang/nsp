import { Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import { DemoModeProvider } from './contexts/DemoModeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
import { useThemeMode } from './hooks/useThemeMode'
import { Theme } from '@astryxdesign/core/theme'
import { koperasiTheme } from './design/theme'

const Shell = lazy(() => import('./components/Shell'))
const Login = lazy(() => import('./pages/Login'))
const MemberPortal = lazy(() => import('./pages/MemberPortal'))
const FeedbackWidget = lazy(() => import('./components/feedback/FeedbackWidget'))

function LoadingScreen({ label = 'Loading...' }: { label?: string }) {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {label}
    </div>
  )
}

function AppThemeProvider({ children }: { children: ReactNode }) {
  const { mode } = useThemeMode()
  return (
    <Theme theme={koperasiTheme} mode={mode}>
      {children}
    </Theme>
  )
}

function AdminLoginRoute() {
  const { isAuthenticated, isChecking } = useAuth()
  const location = useLocation()

  if (isChecking) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    const from =
      (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/'
    const target = from.startsWith('/portal') || from === '/login' ? '/' : from
    return <Navigate to={target} replace />
  }

  return <Login />
}

function AdminAppRoute() {
  const { isAuthenticated, isChecking } = useAuth()
  const location = useLocation()

  if (isChecking) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    const path = location.pathname
    if (path === '/' || path === '') {
      return <Navigate to="/portal" replace />
    }
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Shell />
}

export function RootApp() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AppThemeProvider>
            <AuthProvider>
              <DemoModeProvider>
                <Suspense fallback={<LoadingScreen label="Loading App..." />}>
                  <Routes>
                    <Route path="/portal/*" element={<MemberPortal />} />
                    <Route path="/login" element={<AdminLoginRoute />} />
                    <Route path="/*" element={<AdminAppRoute />} />
                  </Routes>
                  <FeedbackWidget />
                </Suspense>
              </DemoModeProvider>
            </AuthProvider>
          </AppThemeProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
