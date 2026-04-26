import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Providers from './pages/Providers'
import Routing from './pages/Routing'
import Chat from './pages/Chat'
import TokenInput from './pages/TokenInput'
import Landing from './pages/Landing'

/**
 * BUILD MODES:
 * 
 * 1. VITE_PUBLIC_BUILD=true  → GitHub Pages (public)
 *    - Landing page + docs + download + changelog
 *    - User dashboard (connects to localhost:7860)
 *    - NO admin panel (stripped from build)
 * 
 * 2. VITE_PUBLIC_BUILD=false → Local dev (default)
 *    - Everything: user dashboard + admin panel
 *    - Admin panel at /admin
 */
const isPublicBuild = import.meta.env.VITE_PUBLIC_BUILD === 'true'

// Lazy load admin components (tree-shaken in public build)
const AdminLogin = !isPublicBuild ? lazy(() => import('./admin/pages/AdminLogin')) : null
const AdminDashboard = !isPublicBuild ? lazy(() => import('./admin/pages/AdminDashboard')) : null
const AdminLicenses = !isPublicBuild ? lazy(() => import('./admin/pages/AdminLicenses')) : null
const AdminLayout = !isPublicBuild ? lazy(() => import('./admin/components/AdminLayout')) : null

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="flex items-center gap-3 text-orange-400 font-mono">
        <div className="w-5 h-5 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin"></div>
        <span>LOADING...</span>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { authenticated, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="flex items-center gap-3 text-cyan-400 font-mono">
        <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
        <span>CONNECTING...</span>
      </div>
    </div>
  )
  if (!authenticated) return <Navigate to="/auth" />
  return children
}

function AdminGuard() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('xixero_admin_token'))

  if (!authed) return (
    <Suspense fallback={<LoadingScreen />}>
      <AdminLogin onLogin={() => setAuthed(true)} />
    </Suspense>
  )

  const handleLogout = () => {
    import('./admin/lib/adminApi').then(m => m.adminApi.clearToken())
    setAuthed(false)
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <AdminLayout onLogout={handleLogout} />
    </Suspense>
  )
}

// Detect environment
function isLocalhost() {
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')
}

export default function App() {
  const local = isLocalhost()

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing page - always available */}
          <Route path="/landing" element={<Landing />} />

          {/* Auth page - for local user dashboard */}
          <Route path="/auth" element={<TokenInput />} />

          {/* Admin routes - ONLY in local/dev builds */}
          {!isPublicBuild && (
            <Route path="/admin" element={<AdminGuard />}>
              <Route index element={
                <Suspense fallback={<LoadingScreen />}>
                  <AdminDashboard />
                </Suspense>
              } />
              <Route path="licenses" element={
                <Suspense fallback={<LoadingScreen />}>
                  <AdminLicenses />
                </Suspense>
              } />
            </Route>
          )}

          {/* Root: Landing on public domain, Dashboard on localhost */}
          {local ? (
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="providers" element={<Providers />} />
              <Route path="routing" element={<Routing />} />
              <Route path="chat" element={<Chat />} />
            </Route>
          ) : (
            <Route path="/" element={<Landing />} />
          )}

          {/* Catch-all */}
          <Route path="*" element={<Navigate to={local ? '/' : '/'} />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
