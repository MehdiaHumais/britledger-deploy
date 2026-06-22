'use client'

import React, { useEffect, useState } from 'react'
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

  useEffect(() => {
    // Check local storage or system preference
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

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDark(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
    }
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
        <Sidebar 
          isCollapsed={isCollapsed} 
          setIsCollapsed={setIsCollapsed}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
        />
        
        {/* Global Theme Toggle & Notifications */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <NotificationBell />
          <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full bg-background shadow-sm border-primary/20">
            {isDark ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-slate-700" />}
          </Button>
        </div>

        <main 
          className={cn(
            "flex-1 transition-all duration-300 ease-in-out",
            isCollapsed ? "lg:pl-[80px]" : "lg:pl-[260px]"
          )}
        >
          <div className="container mx-auto p-4 md:p-8 pt-20 lg:pt-8 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
