'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const [isReady, setIsReady] = useState(false)
  const checkedRef = useRef(false)

  const publicRoutes = ['/login', '/register', '/forgot-password']

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true
    if (!isAuthenticated && !publicRoutes.includes(pathname)) {
      router.push('/login')
    } else if (isAuthenticated && publicRoutes.includes(pathname)) {
      router.push('/dashboard')
    }
    setIsReady(true)
  }, [isAuthenticated, pathname, router])

  if (!isReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
