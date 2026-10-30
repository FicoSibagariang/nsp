import { createContext, useContext } from 'react'
import type { Permission } from '@shared/permissions'

export interface AuthContextType {
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

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
