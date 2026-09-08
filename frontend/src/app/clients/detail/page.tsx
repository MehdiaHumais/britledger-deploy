'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Mail, Phone, Building2, FileText, CheckCircle2, Loader2, Edit, Trash2, Eye } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import db from '@/lib/local-db'

function ClientDetailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')

  const [client, setClient] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!id) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        await db.clients.syncFromApi()
        const c = db.clients.findOne((c: any) => c.id === id)
        if (!c) {
          router.push('/clients')
          return
        }

        const allInvoices = db.invoices.getAll()
        const clientInvoices = allInvoices
          .filter(i => i.clientId === id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        c.balance = clientInvoices
          .filter(i => normalizeStatus(i.status) !== 'paid' && normalizeStatus(i.status) !== 'draft')
          .reduce((sum, i) => sum + Number(i.amount), 0)
        c.totalPaid = clientInvoices
          .filter(i => normalizeStatus(i.status) === 'paid')
          .reduce((sum, i) => sum + Number(i.amount), 0)

        setClient(c)
        setInvoices(clientInvoices)
      } catch (error) {
        console.error('Failed to load client detail:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [id, router])

  // Helper to normalize status for case-insensitive comparison
  const normalizeStatus = (status: string): string => {
    return status?.toLowerCase().trim() || ''
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (!client) return null

  const payments = invoices.filter(i => normalizeStatus(i.status) === 'paid')

  const statusVariant = (s: string) => {
    const normalized = normalizeStatus(s)
    return normalized === 'paid' ? 'default' : normalized === 'overdue' ? 'destructive' : normalized === 'draft' ? 'secondary' : 'outline'
  }

  const clientStatusVariant = normalizeStatus(client.status) === 'active' ? 'default' : 'secondary'

  const handleDelete = async () => {
    try {
      await db.clients.delete(id)
      router.push('/clients')
      router.refresh()
    } catch (error) {
      console.error('Failed to delete client:', error)
    }
  }

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
              <Badge variant={clientStatusVariant} className="h-6">
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
              <h2 className="text-3xl font-bold mt-2 text-destructive">{formatCurrency(client.balance)}</h2>
              <p className="text-xs text-muted-foreground mt-1">{invoices.filter(i => normalizeStatus(i.status) !== 'paid' && normalizeStatus(i.status) !== 'draft').length} unpaid invoices</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
              <h2 className="text-3xl font-bold mt-2 text-green-600">{formatCurrency(client.totalPaid)}</h2>
              <p className="text-xs text-muted-foreground mt-1">{payments.length} paid invoices</p>
            </CardContent>
          </Card>
        </div>

        {/* Client Details & Invoices */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Client Information</CardTitle>
                <CardDescription>Contact and billing details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
                  <p className="mt-1">{client.email}</p>
                </div>
                {client.phone && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</label>
                    <p className="mt-1">{client.phone}</p>
                  </div>
                )}
                {client.address && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Address</label>
                    <p className="mt-1 whitespace-pre-line">{client.address}</p>
                  </div>
                )}
                {client.taxId && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tax ID</label>
                    <p className="mt-1">{client.taxId}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                  <div className="mt-1">
                    <Badge variant={clientStatusVariant}>{client.status}</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</label>
                  <p className="mt-1">{formatDate(client.createdAt)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Client
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Invoices</h2>
                <p className="text-sm text-muted-foreground">{invoices.length} total invoices</p>
              </div>
              <Button onClick={() => router.push(`/invoices/new?clientId=${id}`)}>
                <FileText className="mr-2 h-4 w-4" />
                New Invoice
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {invoices.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">No invoices yet</h3>
                    <p className="text-muted-foreground mt-1">Create your first invoice for this client</p>
                    <Button className="mt-4" onClick={() => router.push(`/invoices/new?clientId=${id}`)}>
                      Create Invoice
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono font-medium">{invoice.invoiceNumber}</TableCell>
                            <TableCell>{formatDate(invoice.date)}</TableCell>
                            <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(invoice.amount)}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(invoice.status)}>
                                {invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => router.push(`/invoices/${invoice.id}/edit`)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delete Client</CardTitle>
              <CardDescription>This action cannot be undone</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Are you sure you want to delete <strong>{client.name}</strong>? This will also delete all associated invoices.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  )
}

export default function ClientDetailPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    }>
      <ClientDetailContent />
    </Suspense>
  )
}