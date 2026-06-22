'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

// ── Context ────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Single Toast item ──────────────────────────────────────────────────────
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // Immediate visibility
    const showTimer = setTimeout(() => setVisible(true), 10)
    // Auto-dismiss
    const duration = toast.duration ?? 4000
    const timer = setTimeout(() => dismiss(), duration)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(timer)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    setLeaving(true)
    setTimeout(() => onRemove(toast.id), 400)
  }

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />,
    error:   <XCircle     size={20} className="text-rose-500   shrink-0 mt-0.5" />,
    warning: <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />,
    info:    <Info        size={20} className="text-blue-500  shrink-0 mt-0.5" />,
  }

  const accents: Record<ToastType, string> = {
    success: 'border-l-emerald-500',
    error:   'border-l-rose-500',
    warning: 'border-l-amber-500',
    info:    'border-l-blue-500',
  }

  const progressColors: Record<ToastType, string> = {
    success: 'bg-emerald-500',
    error:   'bg-rose-500',
    warning: 'bg-amber-500',
    info:    'bg-blue-500',
  }

  return (
    <div
      role="alert"
      className={`
        relative w-full max-w-sm overflow-hidden rounded-xl border-l-4 
        bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200/60 dark:shadow-slate-900/80
        transition-all duration-300 ease-out
        ${visible && !leaving ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-12 opacity-0 scale-95'}
        ${accents[toast.type]}
      `}
    >
      {/* Content */}
      <div className="flex items-start gap-3 px-4 py-3.5 pr-10">
        {icons[toast.type]}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">
            {toast.title}
          </p>
          {toast.message && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-snug">
              {toast.message}
            </p>
          )}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={dismiss}
        className="absolute top-2.5 right-2.5 rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>

      {/* Progress bar */}
      <div className="h-0.5 w-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full ${progressColors[toast.type]}`}
          style={{
            animation: `toast-progress ${toast.duration ?? 4000}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  )
}

// ── Provider ───────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...opts, id }])
  }, [])

  const success = useCallback((title: string, message?: string) =>
    toast({ type: 'success', title, message }), [toast])

  const error = useCallback((title: string, message?: string) =>
    toast({ type: 'error', title, message }), [toast])

  const warning = useCallback((title: string, message?: string) =>
    toast({ type: 'warning', title, message }), [toast])

  const info = useCallback((title: string, message?: string) =>
    toast({ type: 'info', title, message }), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}

      {/* Toast container — fixed bottom-right */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-3 items-end pointer-events-none"
        style={{ maxWidth: '380px', width: 'calc(100vw - 40px)' }}
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto w-full">
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
