'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, CircleDollarSign, CheckCircle2, AlertCircle } from 'lucide-react'
import { paymentApi, clientApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'

function PaymentPageContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const status = searchParams.get('status')
  
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<string | null>(null)
  const { success, error } = useToast()

  useEffect(() => {
    if (id) fetchInvoice()
  }, [id])

  const fetchInvoice = async () => {
    try {
      // In a real app, this should be a public endpoint. 
      // For now we'll assume it works if we have the ID.
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://ledger.britsyncai.com'}/api/v1/invoices/${id}`).then(res => res.json())
      setInvoice(response)
    } catch (err) {
      console.error('Error fetching invoice:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePay = async (provider: 'stripe' | 'paypal') => {
    setPaying(provider)
    try {
      const response = await paymentApi.createSession({
        invoice_id: id,
        provider,
        success_url: `${window.location.origin}/pay/detail?id=${id}&status=success`,
        cancel_url: `${window.location.origin}/pay/detail?id=${id}&status=cancel`
      })
      
      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url
      }
    } catch (err) {
      error('Payment Failed', 'Could not initiate payment session.')
      setPaying(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center p-8 border-none shadow-2xl">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="text-green-500" size={64} />
          </div>
          <CardTitle className="text-2xl mb-2">Payment Successful!</CardTitle>
          <CardDescription className="mb-6">
            Thank you for your payment. Your invoice has been updated and a confirmation email has been sent.
          </CardDescription>
          <Button onClick={() => window.close()} className="w-full">Close Window</Button>
        </Card>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold">Invoice Not Found</h2>
          <p className="text-muted-foreground">The invoice you are looking for does not exist or has been removed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">BritLedger AI</h1>
          <p className="text-slate-500">Secure Payment Portal</p>
        </div>

        <Card className="border-none shadow-2xl overflow-hidden rounded-2xl">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-10 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-indigo-100 text-sm font-medium mb-1 uppercase tracking-wider">Invoice Number</p>
                <h2 className="text-4xl font-black">{invoice.invoice_number}</h2>
              </div>
              <div className="text-right">
                <p className="text-indigo-100 text-sm font-medium mb-1 uppercase tracking-wider">Amount Due</p>
                <h2 className="text-4xl font-black">{invoice.currency} {invoice.total_amount?.toLocaleString()}</h2>
              </div>
            </div>
          </div>
          
          <CardContent className="p-10 space-y-10 bg-white">
            <div className="grid md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Billing Details</h3>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-800">{invoice.client_name || 'Client'}</p>
                  <p className="text-slate-500">{invoice.client_email || 'No email provided'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Invoice Info</h3>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Due Date:</span>
                  <span className="font-bold text-slate-800">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${invoice.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {invoice.status}
                  </span>
                </div>
              </div>
            </div>

            {invoice.status === 'PAID' ? (
              <div className="bg-green-50 border-2 border-green-100 text-green-800 p-6 rounded-xl flex items-center gap-4">
                <div className="bg-green-500 p-2 rounded-full text-white">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="font-bold">Fully Paid</p>
                  <p className="text-sm opacity-90">This invoice was settled on {new Date().toLocaleDateString()}.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 pt-4">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Select Payment Method</h3>
                  <p className="text-slate-500 text-sm">Choose your preferred way to pay securely.</p>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-6">
                  <Button 
                    variant="outline" 
                    className="h-32 flex-col gap-3 hover:border-indigo-600 hover:bg-indigo-50/30 transition-all duration-300 border-2 rounded-2xl group shadow-sm"
                    onClick={() => handlePay('stripe')}
                    disabled={!!paying}
                  >
                    {paying === 'stripe' ? (
                      <Loader2 className="animate-spin text-indigo-600" size={32} />
                    ) : (
                      <>
                        <div className="p-3 bg-indigo-100 rounded-full text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <CreditCard size={28} />
                        </div>
                        <span className="font-bold text-slate-700 group-hover:text-indigo-600">Credit / Debit Card</span>
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-32 flex-col gap-3 hover:border-[#0070ba] hover:bg-[#0070ba]/5 transition-all duration-300 border-2 rounded-2xl group shadow-sm"
                    onClick={() => handlePay('paypal')}
                    disabled={!!paying}
                  >
                    {paying === 'paypal' ? (
                      <Loader2 className="animate-spin text-[#0070ba]" size={32} />
                    ) : (
                      <>
                        <div className="p-3 bg-[#0070ba]/10 rounded-full text-[#0070ba] group-hover:bg-[#0070ba] group-hover:text-white transition-colors">
                          <CircleDollarSign size={28} />
                        </div>
                        <span className="font-bold text-slate-700 group-hover:text-[#0070ba]">PayPal Checkout</span>
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="pt-10 flex flex-col items-center gap-4">
                   <div className="flex items-center gap-6 opacity-30 grayscale contrast-125">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-5" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-6" />
                   </div>
                  <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    Encrypted and Secured by BritLedger PCI-DSS Infrastructure
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <p className="text-center text-slate-400 text-xs">
          &copy; {new Date().getFullYear()} BritLedger AI. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default function PublicPaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
      <PaymentPageContent />
    </Suspense>
  )
}
