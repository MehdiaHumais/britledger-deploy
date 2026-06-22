'use client'

import React, { useState, useEffect } from 'react'
import { Bell, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import db from '@/lib/local-db'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/store/auth-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from '@/components/ui/badge'
import { TrendingUp, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function NotificationBell() {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [selectedAiInsight, setSelectedAiInsight] = useState<any>(null)
  const [showAiModal, setShowAiModal] = useState(false)

  // Fetch and check for overdue items
  const checkNotifications = () => {
    if (!user) return
    
    // Auto-generate overdue notifications if needed
    const invoices = db.invoices.getAll()
    const quotations = db.quotations.getAll()
    const expenses = db.expenses.getAll()
    
    const today = new Date()
    
    const checkOverdue = (items: any[], type: string, actionText: string) => {
      items.forEach(item => {
        if (item.status === 'Paid' || item.status === 'Accepted' || item.status === 'Paid (Expense)') return
        
        const dueDate = new Date(item.dueDate || item.date)
        if (dueDate < today && item.status !== 'Overdue') {
          // Check if notification already exists
          const existing = db.notifications.findOne((n: any) => n.referenceId === item.id)
          if (!existing) {
            db.notifications.insert({
              title: `${type} Overdue`,
              message: `${type} ${item.number || ''} is overdue. ${actionText}`,
              referenceId: item.id,
              isRead: false,
              date: new Date().toISOString()
            })
            // Update item status to Overdue in local DB
            if (type === 'Invoice') db.invoices.update(item.id, { status: 'Overdue' })
            if (type === 'Quotation') db.quotations.update(item.id, { status: 'Expired' })
          }
        }
      })
    }

    checkOverdue(invoices, 'Invoice', 'The client has not paid this invoice yet.')
    checkOverdue(quotations, 'Quotation', 'The client has not accepted this quotation.')
    checkOverdue(expenses, 'Expense', 'This expense is past its payment date.')

    // Load notifications from DB
    const allNotifs = db.notifications.getAll('date', false)
    setNotifications(allNotifs)
  }

  useEffect(() => {
    checkNotifications()
    // Poll every 30 seconds
    const interval = setInterval(checkNotifications, 30000)
    return () => clearInterval(interval)
  }, [user])

  const unreadCount = notifications.filter(n => !n.isRead).length

  const markAsRead = (id: string) => {
    const notif = notifications.find(n => n.id === id)
    db.notifications.update(id, { isRead: true })
    setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n))
    
    if (notif?.type === 'ai_insight' && notif.metadata) {
      setSelectedAiInsight(notif.metadata)
      setShowAiModal(true)
      setOpen(false) // Close dropdown
    }
  }

  const clearAll = () => {
    notifications.forEach(n => db.notifications.delete(n.id))
    setNotifications([])
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-full bg-background relative">
            <Bell size={18} className="text-slate-700 dark:text-slate-200" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between p-4 border-b">
            <h4 className="font-semibold">Notifications</h4>
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-2 text-xs text-muted-foreground">
              <Trash2 size={14} className="mr-1" /> Clear
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No notifications
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  className={`p-4 border-b last:border-0 hover:bg-muted/50 cursor-pointer ${!notif.isRead ? 'bg-primary/5' : ''}`}
                  onClick={() => markAsRead(notif.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h5 className={`text-sm ${!notif.isRead ? 'font-bold' : 'font-medium'}`}>{notif.title}</h5>
                    {!notif.isRead && <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{notif.message}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(notif.date).toLocaleDateString()} {new Date(notif.date).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-primary/10 rounded-full text-primary">
                <TrendingUp size={20} />
              </div>
              <Badge variant="secondary">Saved AI Insight</Badge>
            </div>
            <DialogTitle className="text-2xl">Financial Analysis Report</DialogTitle>
            <DialogDescription>
              Previously generated business performance analysis.
            </DialogDescription>
          </DialogHeader>

          {selectedAiInsight && (
            <div className="space-y-6 py-4">
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border">
                <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-2">Executive Summary</h4>
                <p className="text-lg leading-relaxed">{selectedAiInsight.summary}</p>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500">Actionable Insights</h4>
                <div className="grid gap-3">
                  {selectedAiInsight.insights?.map((insight: any, i: number) => (
                    <div key={i} className="flex gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border shadow-sm">
                      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                        insight.priority === 'high' ? 'bg-rose-500' : 
                        insight.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                      }`} />
                      <div>
                        <p className="font-semibold text-sm">{insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedAiInsight.vat_reminder && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                  <h4 className="font-bold text-sm text-amber-800 dark:text-amber-400 mb-1">VAT Compliance Notice</h4>
                  <p className="text-sm">{selectedAiInsight.vat_reminder}</p>
                </div>
              )}
              
              <Button className="w-full" onClick={() => setShowAiModal(false)}>
                Close Historical Report
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
