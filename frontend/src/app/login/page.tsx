'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { Fingerprint } from 'lucide-react'
import db from '@/lib/local-db'
import api from '@/lib/api'
import { signJWT } from '@/lib/jwt'
import { FingerprintCredentialsModal } from '@/components/auth/fingerprint-credentials-modal'
import { authenticateBiometric, registerBiometric } from '@/lib/biometric'
import { useBiometricAvailable } from '@/lib/useBiometricAvailable'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFingerprintLoading, setIsFingerprintLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const setUser = useAuthStore((state) => state.setUser)
  const setToken = useAuthStore((state) => state.setToken)
  const biometricAvailable = useBiometricAvailable()
  const router = useRouter()

  useEffect(() => {
    const reason = sessionStorage.getItem('britledger_logout_reason')
    if (reason) {
      setError(reason)
      sessionStorage.removeItem('britledger_logout_reason')
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    setTimeout(async () => {
      const user = db.users.findOne((u: any) => u.email?.toLowerCase() === email.toLowerCase() && u.password === password)

      if (user) {
        const secret = process.env.NEXT_PUBLIC_JWT_SECRET || 'fallback_secret'
        const payload = {
          sub: user.id,
          email: user.email,
          name: user.name,
          company: user.company_name,
          exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30)
        }
        
        try {
          const token = await signJWT(payload, secret)
          
          setUser({
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            company_name: user.company_name || 'My Company',
            vat_number: user.vat_number,
            address: user.address,
            email_notifications: user.email_notifications,
            ai_notifications: user.ai_notifications
          })
          setToken(token)
          
          localStorage.setItem('britledger_token', token)
          
          setIsLoading(false)
          router.push('/dashboard')
        } catch (err) {
          setError('Failed to generate authentication token')
          setIsLoading(false)
        }
      } else {
        setError('Invalid email or password. If you do not have an account, please register.')
        setIsLoading(false)
      }
    }, 800)
  }

  const handleFingerprint = async () => {
    setIsFingerprintLoading(true)
    setError('')

    const result = await authenticateBiometric()
    if (!result) {
      setError('Biometric verification was cancelled or failed. Please try again.')
      setIsFingerprintLoading(false)
      return
    }

    const deviceId = result.credentialId.includes(':')
      ? result.credentialId.split(':')[1]
      : result.credentialId

    let backendToken: string | null = null
    try {
      const loginRes = await api.post(
        '/api/v1/auth/fingerprint/login',
        { device_id: deviceId },
        { timeout: 15000 }
      )
      backendToken = loginRes?.data?.access_token || null
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail || ''
      if (status === 404) {
        setError(detail || 'No fingerprint account found. Please register first.')
      } else {
        setError(detail || 'Server error. Please try again later.')
      }
      setIsFingerprintLoading(false)
      return
    }

    if (!backendToken) {
      setError('No fingerprint account found for this device. Please sign up first.')
      setIsFingerprintLoading(false)
      return
    }

    // Local record so the app's local data works (keyed by biometric id)
    let localUser = db.users.findOne((u: any) => u.biometric_id === result.credentialId)
    if (!localUser) {
      localUser = db.users.insert({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        name: 'Fingerprint User',
        biometric_id: result.credentialId,
        is_fingerprint: true,
      })
    }

    try {
      setUser({
        id: localUser.id,
        name: localUser.name,
        email: localUser.email || '',
        is_fingerprint: true,
      })
      setToken(backendToken)
      localStorage.setItem('britledger_token', backendToken)
      setIsFingerprintLoading(false)
      if (!localUser.email || !localUser.password) {
        setShowCredentialsModal(true)
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      setError('Failed to authenticate')
      setIsFingerprintLoading(false)
    }
  }

  const handleFingerprintSignup = async () => {
    setIsFingerprintLoading(true)
    setError('')

    const result = await registerBiometric('')
    if (!result) {
      setError('Biometric registration was cancelled or failed.')
      setIsFingerprintLoading(false)
      return
    }

    const name = prompt('Enter your name to create a fingerprint account:')
    if (!name) {
      setIsFingerprintLoading(false)
      return
    }

    const existingUser = db.users.findOne((u: any) => u.biometric_id === result.credentialId)
    if (existingUser) {
      setError('This device already has a fingerprint account. Please log in.')
      setIsFingerprintLoading(false)
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
        { device_id: deviceId, name },
        { timeout: 15000 }
      )
      backendToken = regRes?.data?.data?.access_token || null
      userId = regRes?.data?.data?.user_id || null
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail || ''
      if (status === 409) {
        setError('This device is already registered. Use "Fingerprint Login" instead.')
      } else {
        setError(detail || 'Server error. Please try again later.')
      }
      setIsFingerprintLoading(false)
      return
    }

    if (!backendToken) {
      setError('Could not create your fingerprint account on the server. Please try again.')
      setIsFingerprintLoading(false)
      return
    }

    const newUser = db.users.insert({
      id: userId || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
      name,
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
      setIsFingerprintLoading(false)
      setShowCredentialsModal(true)
    } catch (err) {
      setError('Failed to authenticate')
      setIsFingerprintLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
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
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-muted-foreground mt-2">Enter your credentials to access your account</p>
        </div>

        <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none">
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>
              Sign in to manage your bookkeeping
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">Email</label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="password">Password</label>
                  <Link href="/forgot-password" title="Recover password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Logging in...
                  </div>
                ) : 'Sign In'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            {biometricAvailable && (
              <>
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleFingerprint}
                  disabled={isFingerprintLoading}
                >
                  {isFingerprintLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <Fingerprint size={18} />
                  )}
                  Fingerprint Login
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={handleFingerprintSignup}
                  disabled={isFingerprintLoading}
                >
                  New here? Create fingerprint account
                </Button>
              </>
            )}
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/register" title="Create account" className="text-primary hover:underline font-semibold">
                Register with Email
              </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
      <FingerprintCredentialsModal open={showCredentialsModal} onClose={() => router.push('/dashboard')} />
    </div>
  )
}
