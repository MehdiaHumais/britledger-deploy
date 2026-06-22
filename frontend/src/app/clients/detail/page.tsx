'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Mail, Phone, Building2, FileText, CheckCircle2, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import db from '@/lib/local-db'

function ClientDetailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')

  const [client, setClient] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => {
    if (!id) return

    const c = db.clients.findOne((c: any) => c.id === id)
    if (!c) {
      router.push('/clients')
      return
    }

    const allInvoices = db.invoices.getAll()
    const clientInvoices = allInvoices.filter(i => i.clientId === id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    c.balance = clientInvoices.filter(i => i.status !== 'Paid' && i.status !== 'Draft').reduce((sum, i) => sum + Number(i.amount), 0)
    c.totalPaid = clientInvoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + Number(i.amount), 0)

    setClient(c)
    setInvoices(clientInvoices)
  }, [id, router])

  if (!client) return null

  const payments = invoices.filter(i => i.status === 'Paid')

  const statusVariant = (s: string) =>
    s === 'Paid' ? 'default' : s === 'Overdue' ? 'destructive' : s === 'Draft' ? 'secondary' : 'outline'

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4">
          <button onClick={() => router.push('/clients')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
            <ArrowLeft size={16} /> Back to Clients
          </button>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Building2 size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1.5"><Mail size={14} /> {client.email}</span>
                    {client.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {client.phone}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant={client.status === 'Active' ? 'default' : 'secondary'} className="h-6">
                {client.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-none shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Total Invoiced</p>
              <h2 className="text-3xl font-bold mt-2">{formatCurrency(client.balance + client.totalPaid)}</h2>
              <p className="text-xs text-muted-foreground mt-1">{invoices.length} total invoices generated</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
              <h2 className={cn("text-3xl font-bold mt-2", client.balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                {formatCurrency(client.balance)}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Pending payments</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
              <h2 className="text-3xl font-bold mt-2 text-primary">{formatCurrency(client.totalPaid)}</h2>
              <p className="text-xs text-muted-foreground mt-1">Across {payments.length} successful payments</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Invoice History */}
          <Card className="border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2"><FileText size={18}/> Invoice History</CardTitle>
                <CardDescription>All invoices issued to this client</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/invoices')}>Create Invoice</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length > 0 ? invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.number}</TableCell>
                      <TableCell>{formatDate(inv.date)}</TableCell>
                      <TableCell>{formatCurrency(inv.amount)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={statusVariant(inv.status) as any}>{inv.status}</Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No invoices found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card className="border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-500"/> Payment History</CardTitle>
              <CardDescription>Record of all settled invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref (Invoice)</TableHead>
                    <TableHead>Date Issued</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length > 0 ? payments.map(pay => (
                    <TableRow key={pay.id}>
                      <TableCell className="font-medium">{pay.number}</TableCell>
                      <TableCell>{formatDate(pay.date)}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(pay.amount)}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No payments recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function ClientDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
      <ClientDetailContent />
    </Suspense>
  )
}
