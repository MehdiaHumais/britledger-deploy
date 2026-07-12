'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Trash2, Shield, ShieldOff, UserCog } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'

interface UserRow {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

export function AdminUsers() {
  const { success, error: showError } = useToast()
  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/admin/users', { timeout: 15000 })
      const list = res.data?.data || []
      setUsers(Array.isArray(list) ? list : [])
    } catch (err: any) {
      if (err?.response?.status === 401) return
      showError('Failed to load users', err.response?.data?.detail || 'Server error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleToggleActive = async (user: UserRow) => {
    setTogglingId(user.id)
    try {
      await api.patch(`/api/v1/admin/users/${user.id}`, { is_active: !user.is_active }, { timeout: 15000 })
      success('User Updated', `${user.full_name || user.email} ${user.is_active ? 'disabled' : 'enabled'}`)
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
    } catch (err: any) {
      showError('Update failed', err.response?.data?.detail || 'Server error')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (user: UserRow) => {
    if (!confirm(`Delete user "${user.full_name || user.email}"? This will remove all their data.`)) return
    setDeletingId(user.id)
    try {
      await api.delete(`/api/v1/admin/users/${user.id}`, { timeout: 15000 })
      success('User Deleted', `${user.full_name || user.email} and all associated data removed`)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch (err: any) {
      showError('Delete failed', err.response?.data?.detail || 'Server error')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString() } catch { return '-' }
  }

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserCog size={20} /> User Management</CardTitle>
        <CardDescription>Manage all users — enable, disable, or delete accounts.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Joined</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3">{u.full_name || '-'}</td>
                    <td className="py-3">{u.email}</td>
                    <td className="py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        u.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {u.role || 'USER'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(u)}
                          disabled={togglingId === u.id || u.id === currentUser?.id}
                          title={u.is_active ? 'Disable user' : 'Enable user'}
                        >
                          {togglingId === u.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : u.is_active ? (
                            <ShieldOff className="h-4 w-4 text-red-500" />
                          ) : (
                            <Shield className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(u)}
                          disabled={deletingId === u.id || u.id === currentUser?.id}
                          title="Delete user"
                          className="hover:text-red-600"
                        >
                          {deletingId === u.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}