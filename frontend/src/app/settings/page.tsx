'use client'

import React, { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Building, Shield, Bell, Loader2, CreditCard, UserCog } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/components/ui/toast'
import db from '@/lib/local-db'
import { userApi } from '@/lib/api'
import api from '@/lib/api'
import { PaymentSettings } from '@/components/settings/payment-settings'
import { AdminUsers } from '@/components/settings/admin-users'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const { success, error, warning, info } = useToast()
  const [activeTab, setActiveTab] = useState('profile')
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    avatar: ''
  })
  const [business, setBusiness] = useState({
    companyName: '',
    vatNumber: '',
    address: ''
  })
  
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  })
  const [backupEmail, setBackupEmail] = useState('')
  const [backupPassword, setBackupPassword] = useState('')
  const [isSavingBackup, setIsSavingBackup] = useState(false)
  
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [aiNotifs, setAiNotifs] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'security') setActiveTab('security')
    const code = params.get('code')
    const state = params.get('state')
    const stripeParam = params.get('stripe')

    if (code && stripeParam === 'callback') {
      const finalizeStripe = async () => {
        try {
          const token = useAuthStore.getState().token
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://ledger.britsyncai.com'}/api/v1/payments/stripe/callback?code=${code}&state=${state}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          const data = await response.json()
          if (data.success) {
            success('Stripe Connected', 'Your account is now ready to receive direct payments.')
            // Clean up URL and refresh settings
            window.history.replaceState({}, '', window.location.pathname + '?tab=payments')
          }
        } catch (err) {
          error('Stripe Error', 'Failed to finalize the connection.')
        }
      }
      finalizeStripe()
    }
  }, [])

  useEffect(() => {
    if (user) {
      // Immediately show local user data
      setProfile({
        name: user.name || '',
        email: user.email || '',
        avatar: user.avatar || ''
      })
      setBusiness({ 
        companyName: user.company_name || 'My Company',
        vatNumber: (user as any).vat_number || '',
        address: (user as any).address || ''
      })
      
      setEmailNotifs((user as any).email_notifications ?? true)
      setAiNotifs((user as any).ai_notifications ?? true)
      
      const fetchProfile = async () => {
        try {
          const response = await userApi.getMe()
          if (response.data?.success || response.data) {
            const userData = response.data.data || response.data
            setProfile(p => ({ 
              ...p,
              name: userData.full_name || userData.name || p.name, 
              email: userData.email || p.email, 
              avatar: userData.avatar || p.avatar 
            }))
            // Keep user object synced
            setUser({ ...user, ...userData, name: userData.full_name || userData.name })
          }
        } catch (err) {
          // Silently ignore backend connection errors in local-only mode

        }
      }

      fetchProfile()
    }
  }, [user?.id])

  const [isSaving, setIsSaving] = useState(false)
  const [isSavingBusiness, setIsSavingBusiness] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const handleSaveProfile = async () => {
    if (!user) return
    setIsSaving(true)
    
    try {
      // Update Backend (Don't send email)
      await userApi.updateMe({
        full_name: profile.name,
        avatar: profile.avatar
      })

      // Update Local DB (for legacy)
      db.users.update(user.id, { name: profile.name, email: profile.email, avatar: profile.avatar })
      
      // Update Store
      setUser({ ...user, name: profile.name, email: profile.email, avatar: profile.avatar })
      
      success('Profile Updated', 'Your profile information has been saved.')
    } catch (err) {
      // Backend is offline, fallback seamlessly

      
      // Fallback update
      db.users.update(user.id, { name: profile.name, email: profile.email, avatar: profile.avatar })
      setUser({ ...user, name: profile.name, email: profile.email, avatar: profile.avatar })
      
      success('Profile Updated', 'Your profile information has been saved.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveBusiness = () => {
    if (!user) return
    setIsSavingBusiness(true)
    db.users.update(user.id, { 
      company_name: business.companyName,
      vat_number: business.vatNumber,
      address: business.address
    })
    setUser({ ...user, company_name: business.companyName, vat_number: business.vatNumber, address: business.address } as any)
    setIsSavingBusiness(false)
    success('Business Info Updated', 'Your business details have been saved.')
  }

  const handleSavePassword = () => {
    if (!user) return
    const userData = db.users.findOne((u: any) => u.id === user.id)
    
    // Simulate verification
    if (userData && userData.password && userData.password !== passwords.current) {
      error('Incorrect Password', 'The current password you entered is wrong.')
      return
    }
    
    if (passwords.new !== passwords.confirm) {
      error('Passwords Do Not Match', 'Your new password and confirmation do not match.')
      return
    }
    
    if (passwords.new.length < 8) {
      warning('Password Too Short', 'Password must be at least 8 characters long.')
      return
    }
    
    setIsSavingPassword(true)
    db.users.update(user.id, { password: passwords.new })
    setPasswords({ current: '', new: '', confirm: '' })
    setIsSavingPassword(false)
    success('Password Changed', 'Your password has been updated successfully.')
  }

  const handleToggleEmailNotifs = () => {
    const newVal = !emailNotifs
    setEmailNotifs(newVal)
    if (user) {
      db.users.update(user.id, { email_notifications: newVal })
      setUser({ ...user, email_notifications: newVal } as any)
    }
  }

  const handleToggleAiNotifs = () => {
    const newVal = !aiNotifs
    setAiNotifs(newVal)
    if (user) {
      db.users.update(user.id, { ai_notifications: newVal })
      setUser({ ...user, ai_notifications: newVal } as any)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const img = new Image()
        img.onload = async () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 400
          const MAX_HEIGHT = 400
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          
          // Compress to JPEG with 0.7 quality
          const base64String = canvas.toDataURL('image/jpeg', 0.7)
          
          setProfile(prev => ({ ...prev, avatar: base64String }))
          
          if (user) {
            try {
              // Update Backend
              await userApi.updateMe({ avatar: base64String })
              
              // Update Local
              db.users.update(user.id, { avatar: base64String })
              setUser({ ...user, avatar: base64String })
            } catch (err) {
              // Silently ignore backend connection error for avatar upload

              // Fallback update
              db.users.update(user.id, { avatar: base64String })
              setUser({ ...user, avatar: base64String })
            }
          }
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account, business profile, and preferences.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 flex overflow-x-auto no-scrollbar justify-start sm:justify-center w-full">
            <TabsTrigger value="profile" className="gap-2 shrink-0"><User size={16} /> Profile</TabsTrigger>
            <TabsTrigger value="business" className="gap-2 shrink-0"><Building size={16} /> Business</TabsTrigger>
            <TabsTrigger value="payments" className="gap-2 shrink-0"><CreditCard size={16} /> Payments</TabsTrigger>
            <TabsTrigger value="security" className="gap-2 shrink-0"><Shield size={16} /> Security</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 shrink-0"><Bell size={16} /> Notifications</TabsTrigger>
            {user?.role === 'SUPERADMIN' && (
              <TabsTrigger value="admin" className="gap-2 shrink-0"><UserCog size={16} /> Admin</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="payments">
            <PaymentSettings />
          </TabsContent>

          <TabsContent value="profile">
            {user?.is_fingerprint && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-amber-600 dark:text-amber-400">⚠️</div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-800 dark:text-amber-300">Fingerprint Account</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                      Your account uses fingerprint authentication. Add a backup email and password so you don't lose access.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
                      onClick={() => setActiveTab('security')}
                    >
                      Set Backup Credentials
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader>
                <CardTitle>User Profile</CardTitle>
                <CardDescription>Your personal information and avatar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-dashed border-primary/20 overflow-hidden">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <User size={32} />
                    )}
                  </div>
                  <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                  <Button variant="outline" onClick={handleAvatarClick}>Change Avatar</Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input 
                      value={profile.name} 
                      onChange={(e) => setProfile({...profile, name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <Input 
                      type="email" 
                      value={profile.email} 
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                  </div>
                </div>
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? <><Loader2 size={16} className="animate-spin mr-2" />Saving...</> : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business">
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader>
                <CardTitle>Business Details</CardTitle>
                <CardDescription>Information used for your invoices and tax returns.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Company Name</label>
                    <Input 
                      value={business.companyName}
                      onChange={(e) => setBusiness({...business, companyName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">VAT Number (Optional)</label>
                    <Input 
                      placeholder="GB 123 4567 89" 
                      value={business.vatNumber}
                      onChange={(e) => setBusiness({...business, vatNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Business Address (Optional)</label>
                    <textarea 
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="123 Tech Lane, London, UK"
                      value={business.address}
                      onChange={(e) => setBusiness({...business, address: e.target.value})}
                    />
                  </div>
                </div>
                <Button onClick={handleSaveBusiness} disabled={isSavingBusiness}>
                  {isSavingBusiness ? <><Loader2 size={16} className="animate-spin mr-2" />Saving...</> : 'Update Business Info'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader>
                <CardTitle>{user?.is_fingerprint ? 'Set Backup Credentials' : 'Security'}</CardTitle>
                <CardDescription>
                  {user?.is_fingerprint
                    ? 'Add an email and password as a backup so you can log in even if you lose this device.'
                    : 'Update your password and secure your account.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!user?.is_fingerprint && (
                  <>
                    <div className="space-y-4 max-w-md">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Current Password</label>
                        <Input 
                          type="password" 
                          value={passwords.current}
                          onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">New Password</label>
                        <Input 
                          type="password" 
                          value={passwords.new}
                          onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Confirm New Password</label>
                        <Input 
                          type="password" 
                          value={passwords.confirm}
                          onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                        />
                      </div>
                    </div>
                    <Button onClick={handleSavePassword} disabled={isSavingPassword}>
                      {isSavingPassword ? <><Loader2 size={16} className="animate-spin mr-2" />Updating...</> : 'Change Password'}
                    </Button>
                    
                    <div className="pt-6 border-t">
                      <h4 className="text-sm font-bold mb-2">Two-Factor Authentication</h4>
                      <p className="text-sm text-muted-foreground mb-4">Add an extra layer of security to your account.</p>
                      <Button variant="secondary" onClick={() => info('Coming Soon', '2FA setup will be available in v1.1. Your account is secured via Local Storage.')}>Enable 2FA</Button>
                    </div>
                  </>
                )}
                
                <div className={user?.is_fingerprint ? 'space-y-4 max-w-md' : 'pt-6 border-t space-y-4 max-w-md'}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={backupEmail}
                      onChange={(e) => setBackupEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      type="password"
                      placeholder="Min 8 characters"
                      value={backupPassword}
                      onChange={(e) => setBackupPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!backupEmail || !backupPassword) {
                        warning('Missing Fields', 'Please enter both email and password.')
                        return
                      }
                      if (backupPassword.length < 8) {
                        warning('Weak Password', 'Password must be at least 8 characters.')
                        return
                      }
                      setIsSavingBackup(true)
                      if (user) {
                        try {
                          await api.post('/api/v1/auth/fingerprint/upgrade', { email: backupEmail, password: backupPassword }, { timeout: 15000 })
                          db.users.update(user.id, { email: backupEmail, password: backupPassword, is_fingerprint: false })
                          setUser({ ...user, email: backupEmail, is_fingerprint: false })
                        } catch (err: any) {
                          const detail = err?.response?.data?.detail || 'Server error. Please try again.'
                          error('Failed', detail)
                          setIsSavingBackup(false)
                          return
                        }
                      }
                      setBackupEmail('')
                      setBackupPassword('')
                      setIsSavingBackup(false)
                      success('Credentials Added', 'You can now log in with email or fingerprint.')
                    }}
                    disabled={isSavingBackup}
                  >
                    {isSavingBackup ? <><Loader2 size={16} className="animate-spin mr-2" />Saving...</> : 'Save Backup Credentials'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {user?.role === 'SUPERADMIN' && (
            <TabsContent value="admin">
              <AdminUsers />
            </TabsContent>
          )}

          <TabsContent value="notifications">
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Configure how you want to be alerted.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-xs text-muted-foreground">Receive weekly reports and invoice alerts via email.</p>
                    </div>
                    <Button 
                      variant={emailNotifs ? "default" : "outline"} 
                      size="sm"
                      onClick={handleToggleEmailNotifs}
                    >
                      {emailNotifs ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">AI Insights Alerts</p>
                      <p className="text-xs text-muted-foreground">Get notified when AI detects unusual spending patterns.</p>
                    </div>
                    <Button 
                      variant={aiNotifs ? "default" : "outline"} 
                      size="sm"
                      onClick={handleToggleAiNotifs}
                    >
                      {aiNotifs ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
