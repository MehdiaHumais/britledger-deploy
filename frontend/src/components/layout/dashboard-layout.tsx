'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sidebar } from './sidebar'
import { AuthGuard } from '@/components/auth/auth-guard'
import { Moon, Sun } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { Button } from '@/components/ui/button'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const themeInitialized = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (themeInitialized.current) return
    themeInitialized.current = true
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    } else {
      setIsDark(false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleTheme = useCallback(() => {
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDark(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
    }
  }, [isDark])

  useEffect(() => {
    let App: any
    try {
      App = require('@capacitor/app')?.App
    } catch {}
    if (!App) return
    App.addListener('backButton', () => {
      const hasHistory = window.history.length > 1
      if (hasHistory) {
        router.back()
      }
    })
    return () => { App.removeAllListeners() }
  }, [router])

  return (
    <AuthGuard>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar 
          isCollapsed={isCollapsed} 
          setIsCollapsed={setIsCollapsed}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
        />
        
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <NotificationBell />
          <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full bg-background shadow-sm border-primary/20">
            {isDark ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-slate-700" />}
          </Button>
        </div>

        <main 
          className={cn(
            "flex-1 min-w-0 w-full overflow-x-hidden",
            isCollapsed ? "lg:pl-[80px]" : "lg:pl-[260px]"
          )}
        >
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-8 pt-20 lg:pt-8 pb-8">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
