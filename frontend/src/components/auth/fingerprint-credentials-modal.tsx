'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import db from '@/lib/local-db'
import { useAuthStore } from '@/store/auth-store'
import api from '@/lib/api'

interface Props {
  open: boolean
  onClose: () => void
}

export function FingerprintCredentialsModal({ open, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const handleSave = async () => {
    setError('')
    if (!email || !password) {
      setError('Please fill in both fields.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSaving(true)
    if (user) {
      try {
        await api.post('/api/v1/auth/fingerprint/upgrade', { email, password }, { timeout: 15000 })
        db.users.update(user.id, { email, password, is_fingerprint: false })
        setUser({ ...user, email, is_fingerprint: false })
      } catch (err: any) {
        const detail = err?.response?.data?.detail || 'Server error. Please try again.'
        setError(detail)
        setSaving(false)
        return
      }
    }
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Backup Credentials</DialogTitle>
          <DialogDescription>
            Add an email and password as backup so you can log in even if you lose this device.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Later</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Set Credentials'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
