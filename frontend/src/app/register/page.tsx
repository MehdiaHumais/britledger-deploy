'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { motion } from 'framer-motion'
import db from '@/lib/local-db'
import { signJWT } from '@/lib/jwt'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const setUser = useAuthStore((state) => state.setUser)
  const setToken = useAuthStore((state) => state.setToken)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    setTimeout(async () => {
      // Check if user already exists
      const existingUser = db.users.findOne((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      if (existingUser) {
        setError('An account with this email already exists.')
        setIsLoading(false)
        return
      }

      // Create new user in local-db
      const newUser = db.users.insert({
        name,
        email,
        company_name: companyName,
        password // Storing in plain text locally for simulation
      })
      
      // Generate real JWT token
      const secret = process.env.NEXT_PUBLIC_JWT_SECRET || 'fallback_secret'
      const payload = {
        sub: newUser.id,
        email: newUser.email,
        name: newUser.name,
        company: newUser.company_name,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) // 30 days
      }
      
      try {
        const token = await signJWT(payload, secret)
        
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
              Enter your details to create your BritLedger account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}
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
    </div>
  )
}
