import { useState, lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Providers from './pages/Providers'
import Routing from './pages/Routing'
import Chat from './pages/Chat'
import { api } from './lib/api'

/**
 * Web UI - No login page needed.
 * License check happens in terminal (xixero license <KEY>).
 * If this page loads, server is running = user is licensed.
 * API token auto-injected by Go server via window.XIXERO_CONFIG.
 */

const isPublicBuild = import.meta.env.VITE_PUBLIC_BUILD === 'true'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="flex items-center gap-3 text-cyan-400 font-mono">
        <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
        <span>LOADING...</span>
      </div>
    </div>
  )
}

// Admin - only in dev mode
const LazyAdminLogin = !isPublicBuild ? lazy(() => import('./admin/pages/AdminLogin')) : null
const LazyAdminDashboard = !isPublicBuild ? lazy(() => import('./admin/pages/AdminDashboard')) : null
const LazyAdminLicenses = !isPublicBuild ? lazy(() => import('./admin/pages/AdminLicenses')) : null
const LazyAdminLayout = !isPublicBuild ? lazy(() => import('./admin/components/AdminLayout')) : null

function AdminGuard() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('xixero_admin_token'))

  if (!authed) return (
    <Suspense fallback={<LoadingScreen />}>
      <LazyAdminLogin onLogin={() => setAuthed(true)} />
    </Suspense>
  )

  const handleLogout = () => {
    import('./admin/lib/adminApi').then(m => m.adminApi.clearToken())
    setAuthed(false)
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <LazyAdminLayout onLogout={handleLogout} />
    </Suspense>
  )
}

export default function App() {
  // Auto-set API token from Go server
  useEffect(() => {
    const token = window.XIXERO_CONFIG?.apiToken
    if (token) {
      api.setToken(token)
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin - dev mode only */}
        {!isPublicBuild && (
          <Route path="/admin" element={<AdminGuard />}>
            <Route index element={<Suspense fallback={<LoadingScreen />}><LazyAdminDashboard /></Suspense>} />
            <Route path="licenses" element={<Suspense fallback={<LoadingScreen />}><LazyAdminLicenses /></Suspense>} />
          </Route>
        )}

        {/* Dashboard - langsung, tanpa login */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="providers" element={<Providers />} />
          <Route path="routing" element={<Routing />} />
          <Route path="chat" element={<Chat />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
