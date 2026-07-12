'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { motion } from 'framer-motion'
import { Fingerprint, Mail } from 'lucide-react'
import db from '@/lib/local-db'
import api from '@/lib/api'
import { signJWT } from '@/lib/jwt'
import { FingerprintCredentialsModal } from '@/components/auth/fingerprint-credentials-modal'
import { registerBiometric } from '@/lib/biometric'
import { useBiometricAvailable } from '@/lib/useBiometricAvailable'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  
  const setUser = useAuthStore((state) => state.setUser)
  const setToken = useAuthStore((state) => state.setToken)
  const router = useRouter()
  const biometricAvailable = useBiometricAvailable()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    setTimeout(async () => {
      const existingUser = db.users.findOne((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      if (existingUser) {
        setError('An account with this email already exists.')
        setIsLoading(false)
        return
      }

      try {
        const res = await api.get(`/api/v1/auth/check-email?email=${encodeURIComponent(email)}`, { timeout: 5000 })
        if (res?.data?.data?.exists) {
          setError('An account with this email already exists.')
          setIsLoading(false)
          return
        }
      } catch {
      }

      const newUser = db.users.insert({
        name,
        email,
        company_name: companyName,
        password
      })

      // Create the user in Supabase with the SAME id, and use the backend's
      // access_token so the auth-guard's /me check validates against the backend.
      // Local-first stays primary: if the backend is unreachable we fall back to a
      // locally signed token (works offline, but /me will not validate).
      let backendToken: string | null = null
      try {
        const parts = name.trim().split(/\s+/)
        const regRes = await api.post('/api/v1/auth/register', {
          id: newUser.id,
          first_name: parts[0] || name,
          last_name: parts.slice(1).join(' ') || '-',
          email,
          password,
        }, { timeout: 5000 })
        backendToken = regRes?.data?.data?.access_token || null
      } catch {
        // offline or backend unreachable — local account still works
      }

      const secret = process.env.NEXT_PUBLIC_JWT_SECRET || 'fallback_secret'
      const payload = {
        sub: newUser.id,
        email: newUser.email,
        name: newUser.name,
        company: newUser.company_name,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30)
      }
      
      try {
        const token = backendToken || await signJWT(payload, secret)
        
        setUser({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          company_name: newUser.company_name,
          vat_number: newUser.vat_number,
          address: newUser.address,
          email_notifications: newUser.email_notifications,
          ai_notifications: newUser.ai_notifications
        })
        setToken(token)
        localStorage.setItem('britledger_token', token)
        
        setIsLoading(false)
        router.push('/dashboard')
      } catch (err) {
        setError('Failed to generate authentication token')
        setIsLoading(false)
      }
    }, 800)
  }
  const handleFingerprintRegister = async () => {
    setIsLoading(true)
    setError('')

    const result = await registerBiometric('')
    if (!result) {
      setError('Biometric registration was cancelled or failed. Please try again.')
      setIsLoading(false)
      return
    }

    const fpName = prompt('Enter your name:')
    if (!fpName) {
      setIsLoading(false)
      return
    }

    const deviceId = result.credentialId.includes(':')
      ? result.credentialId.split(':')[1]
      : result.credentialId

    let backendToken: string | null = null
    let userId: string | null = null
    try {
      const regRes = await api.post(
        '/api/v1/auth/fingerprint/register',
        { device_id: deviceId, name: fpName },
        { timeout: 15000 }
      )
      backendToken = regRes?.data?.data?.access_token || null
      userId = regRes?.data?.data?.user_id || null
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail || ''
      if (status === 409) {
        setError('This device is already registered. Try "Fingerprint Login" instead.')
      } else {
        setError(detail || 'Server error. Please try again later.')
      }
      setIsLoading(false)
      return
    }

    if (!backendToken) {
      setError('Could not create your fingerprint account on the server. Please try again.')
      setIsLoading(false)
      return
    }

    // Local record so the app's local data works (same id as the backend user)
    const newUser = db.users.insert({
      id: userId || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
      name: fpName,
      biometric_id: result.credentialId,
      is_fingerprint: true,
    })

    try {
      setUser({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email || '',
        is_fingerprint: true,
      })
      setToken(backendToken)
      localStorage.setItem('britledger_token', backendToken)
      setIsLoading(false)
      setShowCredentialsModal(true)
    } catch (err) {
      setError('Failed to authenticate')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-2xl font-bold shadow-lg shadow-primary/20 mb-4">
            B
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Create an Account</h1>
          <p className="text-muted-foreground mt-2">Start managing your business finances</p>
        </div>

        <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none">
          <CardHeader>
            <CardTitle>Register</CardTitle>
            <CardDescription>
              Choose how you want to create your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}
            <Tabs defaultValue="email" className="w-full">
              <TabsList className={`grid w-full ${biometricAvailable ? 'grid-cols-2' : 'grid-cols-1'} mb-6`}>
                <TabsTrigger value="email" className="gap-2"><Mail size={16} /> Email</TabsTrigger>
                {biometricAvailable && (
                  <TabsTrigger value="fingerprint" className="gap-2"><Fingerprint size={16} /> Fingerprint</TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="email">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="name">Full Name</label>
                    <Input 
                      id="name" 
                      placeholder="John Doe" 
                      required 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="company">Company Name</label>
                    <Input 
                      id="company" 
                      placeholder="Acme Ltd" 
                      required 
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="email">Work Email</label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="name@company.com" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="password">Password</label>
                    <Input 
                      id="password" 
                      type="password" 
                      required 
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Creating account...
                      </div>
                    ) : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
              {biometricAvailable && (
              <TabsContent value="fingerprint">
                <div className="space-y-6 py-4 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <Fingerprint size={40} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Register with Fingerprint</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Use your device&apos;s fingerprint or biometric sensor. No password needed.
                    </p>
                  </div>
                  <Button
                    className="w-full gap-2"
                    onClick={handleFingerprintRegister}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Registering...
                      </div>
                    ) : (
                      <><Fingerprint size={18} /> Register with Fingerprint</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Your fingerprint is stored only on this device. You can add email/password backup later.
                  </p>
                </div>
              </TabsContent>
              )}
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-center border-t p-6">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" title="Sign in" className="text-primary hover:underline font-semibold">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
      <FingerprintCredentialsModal open={showCredentialsModal} onClose={() => router.push('/dashboard')} />
    </div>
  )
}
