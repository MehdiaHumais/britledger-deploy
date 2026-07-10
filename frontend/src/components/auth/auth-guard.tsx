'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import api from '@/lib/api'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token, logout } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const [isReady, setIsReady] = useState(false)
  const checkedRef = useRef(false)

  const publicRoutes = ['/login', '/register', '/forgot-password']

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    const verifySession = async () => {
      if (isAuthenticated && token) {
        try {
          const res = await api.get('/api/v1/auth/me', { timeout: 5000 })
          const userData = res.data?.data
          if (!userData) { throw new Error('No user data') }
          useAuthStore.getState().setUser({
            id: userData.id,
            name: userData.full_name || userData.email,
            email: userData.email,
            role: userData.role,
            is_fingerprint: userData.is_fingerprint,
          })
        } catch (err: any) {
          if (err.response?.status === 401 || err.response?.status === 403) {
            const detail = err.response?.data?.detail || 'Session expired'
            sessionStorage.setItem('britledger_logout_reason', detail)
            logout()
            router.push('/login')
            return
          }
        }
      }

      if (!isAuthenticated && !publicRoutes.includes(pathname)) {
        router.push('/login')
      } else if (isAuthenticated && publicRoutes.includes(pathname)) {
        router.push('/dashboard')
      }
      setIsReady(true)
    }

    verifySession()
  }, [isAuthenticated, pathname, router, logout, token])

  if (!isReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
