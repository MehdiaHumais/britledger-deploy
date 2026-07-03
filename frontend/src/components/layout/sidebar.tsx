'use client'

import React, { memo, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Receipt, 
  CreditCard, 
  PieChart, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  FileBadge
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Quotations', href: '/quotations', icon: FileText },
  { name: 'Invoices', href: '/invoices', icon: Receipt },
  { name: 'Expenses', href: '/expenses', icon: CreditCard },
  { name: 'VAT', href: '/vat', icon: FileBadge },
  { name: 'Reports', href: '/reports', icon: PieChart },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
  isMobileOpen: boolean
  setIsMobileOpen: (value: boolean) => void
}

const NavItem = memo(function NavItem({ 
  item, isActive, isCollapsed, onClick 
}: { 
  item: typeof navItems[0], isActive: boolean, isCollapsed: boolean, onClick: () => void 
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all group relative overflow-hidden",
        isActive 
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      onClick={onClick}
    >
      <item.icon size={20} className={cn(
        "shrink-0 transition-transform duration-200 group-hover:scale-110",
        isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
      )} />
      {!isCollapsed && (
        <span className="truncate">{item.name}</span>
      )}
    </Link>
  )
})

export const Sidebar = memo(function Sidebar({ 
  isCollapsed, 
  setIsCollapsed, 
  isMobileOpen, 
  setIsMobileOpen 
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const toggleSidebar = () => setIsCollapsed(!isCollapsed)
  const toggleMobileSidebar = () => setIsMobileOpen(!isMobileOpen)

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobileOpen])

  const navLinks = useMemo(() => navItems.map((item) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
    return (
      <NavItem
        key={item.name}
        item={item}
        isActive={isActive}
        isCollapsed={isCollapsed}
        onClick={() => setIsMobileOpen(false)}
      />
    )
  }), [pathname, isCollapsed, setIsMobileOpen])

  return (
    <>
      <div className="fixed top-4 left-4 z-[60] lg:hidden">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={toggleMobileSidebar}
          className="rounded-full bg-background shadow-md border-primary/20"
        >
          {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-md lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? '80px' : '260px' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40, mass: 0.5 }}
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r bg-card/95 backdrop-blur-sm shadow-xl",
          "transition-transform duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 py-4">
          {!isCollapsed && (
            <div className="flex items-center gap-2 font-bold text-xl text-primary">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                B
              </div>
              <span>BritLedger <span className="text-foreground">AI</span></span>
            </div>
          )}
          {isCollapsed && (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20 mx-auto">
              B
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden lg:flex hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </Button>
        </div>

        <nav className="flex-1 space-y-1.5 px-3 py-6 overflow-y-auto custom-scrollbar">
          {navLinks}
        </nav>

        <div className="mt-auto border-t border-border/50 p-4">
          <div className={cn(
            "flex items-center gap-3 rounded-xl p-2 transition-colors",
            !isCollapsed && "bg-muted/50"
          )}>
            <div className="h-10 w-10 rounded-full bg-primary/10 overflow-hidden shrink-0 flex items-center justify-center border border-primary/20">
              {user?.avatar ? (
                <img src={user.avatar} className="h-full w-full object-cover" alt="User" />
              ) : (
                <span className="font-bold text-primary">{user?.name?.charAt(0) || 'U'}</span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate leading-none mb-1">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate leading-none">{user?.email}</p>
              </div>
            )}
          </div>
          
          <div className="mt-4">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all",
                isCollapsed && "justify-center px-0"
              )}
              onClick={() => { logout(); router.push('/login') }}
            >
              <LogOut size={20} />
              {!isCollapsed && <span className="font-medium">Logout</span>}
            </Button>
          </div>
        </div>
      </motion.aside>
    </>
  )
})
