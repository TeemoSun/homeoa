import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getToken, setToken } from '../api/client'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  ready: boolean
  login: (token: string, user: User) => void
  logout: () => void
  refresh: () => Promise<void>
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthState>({
  user: null,
  ready: false,
  login: () => {},
  logout: () => {},
  refresh: async () => {},
  updateUser: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setReady(true)
      return
    }
    try {
      const { data } = await api.get<User>('/auth/me')
      setUser(data)
    } catch {
      setToken(null)
      setUser(null)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback((token: string, u: User) => {
    setToken(token)
    setUser(u)
    setReady(true)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((u: User) => setUser(u), [])

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, refresh, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
