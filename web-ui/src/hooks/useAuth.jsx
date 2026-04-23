import { useState, useEffect, createContext, useContext } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('xixero_token')
    if (token) {
      api.setToken(token)
      api.getStatus()
        .then(() => setAuthenticated(true))
        .catch(() => setAuthenticated(false))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (token) => {
    api.setToken(token)
    await api.getStatus()
    setAuthenticated(true)
  }

  const logout = () => {
    api.clearToken()
    setAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ authenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
