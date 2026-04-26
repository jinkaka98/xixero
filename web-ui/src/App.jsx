import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Providers from './pages/Providers'
import Routing from './pages/Routing'
import Chat from './pages/Chat'
import TokenInput from './pages/TokenInput'

/**
 * VITE_PUBLIC_BUILD=true  -> User UI only (for GitHub Pages / localhost:7860)
 * VITE_PUBLIC_BUILD=false -> User UI + Admin panel (local dev only)
 *
 * Admin code is NEVER shipped in public builds.
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

function ProtectedRoute({ children }) {
  const { authenticated, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!authenticated) return <Navigate to="/auth" />
  return children
}

// Admin - only loaded in dev mode
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
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<TokenInput />} />

          {!isPublicBuild && (
            <Route path="/admin" element={<AdminGuard />}>
              <Route index element={<Suspense fallback={<LoadingScreen />}><LazyAdminDashboard /></Suspense>} />
              <Route path="licenses" element={<Suspense fallback={<LoadingScreen />}><LazyAdminLicenses /></Suspense>} />
            </Route>
          )}

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="providers" element={<Providers />} />
            <Route path="routing" element={<Routing />} />
            <Route path="chat" element={<Chat />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
