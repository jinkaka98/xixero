import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Providers from './pages/Providers'
import TokenInput from './pages/TokenInput'

function ProtectedRoute({ children }) {
  const { authenticated, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">Loading...</div>
  if (!authenticated) return <Navigate to="/auth" />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<TokenInput />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="providers" element={<Providers />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
