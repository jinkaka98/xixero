import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('xixero_token')
    if (token) {
      api.setToken(token)
      // Try to validate token against server
      // If server unreachable (e.g. CORS, offline), still allow if token exists
      api.getStatus()
        .then(() => {
          setAuthenticated(true)
          setLoading(false)
        })
        .catch(() => {
          // Token exists but server check failed
          // Still authenticate - token will be validated on actual API calls
          setAuthenticated(true)
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (token) => {
    api.setToken(token)
    // Validate token works
    try {
      await api.getStatus()
    } catch {
      // Even if status fails, token is set - actual API calls will validate
    }
    setAuthenticated(true)
  }, [])

  const logout = useCallback(() => {
    api.clearToken()
    setAuthenticated(false)
  }, [])

  return (
    <AuthContext.Provider value={{ authenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
