'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface Admin {
  email: string
  role: 'admin'
}

interface AuthContextType {
  admin: Admin | null
  accessToken: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const storedToken = localStorage.getItem('adminToken')
    const storedAdmin = localStorage.getItem('adminUser')
    if (storedToken && storedAdmin) {
      setAccessToken(storedToken)
      setAdmin(JSON.parse(storedAdmin))
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Login failed')
    }
    const data = await res.json()
    setAccessToken(data.accessToken)
    setAdmin(data.admin)
    localStorage.setItem('adminToken', data.accessToken)
    localStorage.setItem('adminUser', JSON.stringify(data.admin))
    router.push('/dashboard')
  }, [router])

  const logout = useCallback(() => {
    setAccessToken(null)
    setAdmin(null)
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider value={{ admin, accessToken, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
