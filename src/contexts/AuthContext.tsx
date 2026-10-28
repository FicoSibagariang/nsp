import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api, rpc } from '../services/api'
import { hasPermission as verifyPermission, type Permission } from '@shared/permissions'

interface AuthContextType {
  isAuthenticated: boolean
  isChecking: boolean
  role: string
  isAdmin: boolean
  isSuperAdmin: boolean
  hasPermission: (permission: Permission) => boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: (credential: string) => Promise<void>
  confirmLogin: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [role, setRole] = useState('viewer')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.get('/api/auth/verify')
        .then(() => {
          setIsAuthenticated(true)
          setRole(localStorage.getItem('role') || 'viewer')
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('role')
        })
        .finally(() => setIsChecking(false))
    } else {
      setIsChecking(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await rpc.auth.login.$post({ json: { email, password } })
    const json = (await res.json()) as any
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Login gagal')
    }
    const data = json.data
    localStorage.setItem('token', data.token)
    localStorage.setItem('role', data.role)
    setRole(data.role)
  }, [])

  const loginWithGoogle = useCallback(async (credential: string) => {
    const res = await rpc.auth.google.$post({ json: { credential } })
    const json = (await res.json()) as any
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Login Google gagal')
    }
    const data = json.data
    localStorage.setItem('token', data.token)
    localStorage.setItem('role', data.role)
    setRole(data.role)
  }, [])

  const confirmLogin = useCallback(() => {
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(async () => {
    try {
      await rpc.auth.logout.$post()
    } catch {
      // ignore
    }
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setIsAuthenticated(false)
    setRole('viewer')
    // Always land on admin login after logout (not member portal)
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
  }, [])

  const isAdmin = role === 'admin' || role === 'superadmin'
  const isSuperAdmin = role === 'superadmin'

  const hasPermission = useCallback((permission: Permission) => {
    return verifyPermission(role, permission);
  }, [role]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isChecking, role, isAdmin, isSuperAdmin, hasPermission, login, loginWithGoogle, confirmLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
