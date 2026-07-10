'use client'

import { useEffect, useRef } from 'react'
import { seedSuperAdmin } from '@/lib/seed'

export function AppInitializer({ children }: { children: React.ReactNode }) {
  const seeded = useRef(false)

  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    seedSuperAdmin()
  }, [])

  return <>{children}</>
}