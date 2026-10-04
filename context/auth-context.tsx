"use client"
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AdminRole } from '@/lib/admin-roles'
import { getDemoState } from '@/lib/demo-data'

export type DemoUser = { uid: string; email: string; displayName: string }
export const DEMO_ADMIN: DemoUser = { uid: 'demo-admin', email: 'admin@example.com', displayName: 'Administrator Demo' }
interface AuthContextType {
  user: DemoUser
  loading: boolean
  role: AdminRole
  isAdmin: boolean
  defaultRoute: string
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthContextType | undefined>(undefined)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  useEffect(() => { getDemoState(); setLoading(false) }, [])
  return <AuthContext.Provider value={{ user: DEMO_ADMIN, loading, role: 'admin', isAdmin: true, defaultRoute: '/admin/dashboard', signOut: async () => {} }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth trebuie folosit în AuthProvider')
  return value
}
