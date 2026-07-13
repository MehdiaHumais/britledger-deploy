'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreditCard, Landmark, CircleDollarSign, Loader2, Save, ExternalLink } from 'lucide-react'
import { paymentApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'

export function PaymentSettings() {
  const { success, error } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    stripe_public_key: '',
    stripe_secret_key: '',
    stripe_webhook_secret: '',
    stripe_account_id: '',
    stripe_enabled: false,
    paypal_client_id: '',
    paypal_client_secret: '',
    paypal_enabled: false,
    bank_name: '',
    account_name: '',
    account_number: '',
    sort_code: '',
    iban: '',
    swift_bic: '',
    bank_transfer_enabled: false,
    company_logo_url: '',
    company_vat_number: '',
    company_address: ''
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await paymentApi.getSettings()
      if (response.data) {
        setSettings(prev => ({ ...prev, ...response.data }))
      }
    } catch (err) {
      console.error('Error fetching payment settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await paymentApi.updateSettings(settings)
      success('Settings Saved', 'Your payment configurations have been updated.')
    } catch (err) {
      error('Save Failed', 'Could not update payment settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Payment Configuration</h2>
          <p className="text-muted-foreground">Configure how you receive payments from clients.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Save className="mr-2" size={16} />}
          Save Configuration
        </Button>
      </div>

      <Tabs defaultValue="stripe" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="stripe" className="gap-2">
            <CreditCard size={16} /> Stripe
          </TabsTrigger>
          <TabsTrigger value="paypal" className="gap-2">
            <CircleDollarSign size={16} /> PayPal
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-2">
            <Landmark size={16} /> Bank Transfer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stripe">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Stripe Integration</CardTitle>
                  <CardDescription>Connect your Stripe account to accept card payments.</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="stripe-enabled">Enabled</Label>
                  <Switch 
                    id="stripe-enabled" 
                    checked={settings.stripe_enabled} 
                    onCheckedChange={(val) => setSettings({...settings, stripe_enabled: val})}
                  />
                </div>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-dashed mb-4">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  To use Stripe, enter your API keys below. Get them from your 
                  <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="underline mx-1">Stripe Dashboard</a>
                  (use <strong>live</strong> keys for production).
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Stripe Publishable Key</Label>
                <Input 
                  placeholder="pk_test_..." 
                  value={settings.stripe_public_key}
                  onChange={(e) => setSettings({...settings, stripe_public_key: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>Stripe Secret Key</Label>
                <Input 
                  type="password" 
                  placeholder="sk_test_..." 
                  value={settings.stripe_secret_key}
                  onChange={(e) => setSettings({...settings, stripe_secret_key: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>Webhook Secret</Label>
                <Input 
                  type="password" 
                  placeholder="whsec_..." 
                  value={settings.stripe_webhook_secret}
                  onChange={(e) => setSettings({...settings, stripe_webhook_secret: e.target.value})}
                />
              </div>
              <div className="pt-2">
                <Button variant="link" className="p-0 h-auto text-xs gap-1" asChild>
                  <a href="https://dashboard.stripe.com/apikeers" target="_blank" rel="noreferrer">
                    Get your API keys from Stripe Dashboard <ExternalLink size={12} />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paypal">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>PayPal Integration</CardTitle>
                  <CardDescription>Accept payments via PayPal and Venmo.</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="paypal-enabled">Enabled</Label>
                  <Switch 
                    id="paypal-enabled" 
                    checked={settings.paypal_enabled}
                    onCheckedChange={(val) => setSettings({...settings, paypal_enabled: val})}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>PayPal Client ID</Label>
                <Input 
                  placeholder="Enter Client ID" 
                  value={settings.paypal_client_id}
                  onChange={(e) => setSettings({...settings, paypal_client_id: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>PayPal Client Secret</Label>
                <Input 
                  type="password" 
                  placeholder="Enter Client Secret" 
                  value={settings.paypal_client_secret}
                  onChange={(e) => setSettings({...settings, paypal_client_secret: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Bank Transfer Details</CardTitle>
                  <CardDescription>Show your bank information on invoices for manual transfers.</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="bank-enabled">Enabled</Label>
                  <Switch 
                    id="bank-enabled" 
                    checked={settings.bank_transfer_enabled}
                    onCheckedChange={(val) => setSettings({...settings, bank_transfer_enabled: val})}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Bank Name</Label>
                <Input 
                  placeholder="e.g. Barclays" 
                  value={settings.bank_name}
                  onChange={(e) => setSettings({...settings, bank_name: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>Account Name</Label>
                <Input 
                  placeholder="e.g. BritLedger Ltd" 
                  value={settings.account_name}
                  onChange={(e) => setSettings({...settings, account_name: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>Account Number</Label>
                <Input 
                  placeholder="12345678" 
                  value={settings.account_number}
                  onChange={(e) => setSettings({...settings, account_number: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>Sort Code</Label>
                <Input 
                  placeholder="00-00-00" 
                  value={settings.sort_code}
                  onChange={(e) => setSettings({...settings, sort_code: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>IBAN</Label>
                <Input 
                  placeholder="GB..." 
                  value={settings.iban}
                  onChange={(e) => setSettings({...settings, iban: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>SWIFT/BIC</Label>
                <Input 
                  placeholder="BARCGB..." 
                  value={settings.swift_bic}
                  onChange={(e) => setSettings({...settings, swift_bic: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
