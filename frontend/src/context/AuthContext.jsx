import { createContext, useCallback, useEffect, useState } from 'react'
import { authService } from '../services/authService'
import { tokenStore } from '../services/api'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('auth:logout', onLogout)
    if (tokenStore.access || tokenStore.refresh) {
      authService.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false))
    } else setLoading(false)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  const login = useCallback(async (email, password, remember) => {
    const u = await authService.login(email, password, remember)
    setUser(u)
    return u
  }, [])
  const logout = useCallback(async () => { await authService.logout(); setUser(null) }, [])

  return <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>{children}</AuthContext.Provider>
}
