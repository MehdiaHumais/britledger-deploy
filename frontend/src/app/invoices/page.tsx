'use client'

import React, { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { DocumentBuilder } from '@/components/finance/document-builder'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useToast } from '../../components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import db from '@/lib/local-db'
import { useAuthStore } from '@/store/auth-store'

export default function InvoicesPage() {
  const { success, error } = useToast()
  const [invoices, setInvoices] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('list')
  const [editingInvoice, setEditingInvoice] = useState<any>(null)
  const [deletingInvoice, setDeletingInvoice] = useState<any>(null)

  const load = () => setInvoices(db.invoices.getAll('created_at', false))
  useEffect(() => {
    db.invoices.syncFromApi().finally(() => load())
  }, [])

  const handleSave = async (data: any) => {
    const payload: any = {
      number: data.documentNumber,
      client: data.clientName,
      clientId: data.clientId,
      date: data.date,
      dueDate: data.dueDate,
      amount: data.total,
      subtotal: data.subtotal,
      tax: data.totalTax,
      status: data.status || (editingInvoice ? editingInvoice.status : 'Sent'),
      paid: data.paid,
      advancePayment: data.advancePayment || 0,
      items: data.items,
      notes: data.notes
    }
    if (data.backendId) {
      payload.backendId = data.backendId
    }

    if (editingInvoice) {
      await db.invoices.modifyRecord(editingInvoice.id, payload)
      success('Invoice Updated', `${data.documentNumber} has been updated successfully.`)
    } else {
      await db.invoices.createRecord(payload)
      db.notifications.insert({
        title: 'Invoice Created & Sent',
        message: `Invoice ${data.documentNumber} has been sent to the client.`,
        date: new Date().toISOString(),
        isRead: false
      })
      success('Invoice Saved', `${data.documentNumber} has been saved successfully.`)
    }

    load()
    setEditingInvoice(null)
    setActiveTab('list')
  }

  const handleEditClick = (inv: any) => {
    setEditingInvoice(inv)
    setActiveTab('create')
  }

  const handleTabChange = (val: string) => {
    setActiveTab(val)
    if (val === 'list') {
      setEditingInvoice(null)
    }
  }

  const statusVariant = (s: string) =>
    s === 'Paid' ? 'default' : s === 'Overdue' ? 'destructive' : s === 'Draft' ? 'secondary' : 'outline'

  const markAsPaid = async (inv: any) => {
    await db.invoices.modifyRecord(inv.id, { status: 'Paid' })
    db.notifications.insert({
      title: 'Payment Received',
      message: `Payment confirmed for invoice ${inv.number}.`,
      date: new Date().toISOString(),
      isRead: false
    })
    load()
    success('Marked as Paid', 'Invoice status updated to Paid.')
  }

  const handleDeleteInvoice = async (inv: any) => {
    await db.invoices.removeRecord(inv.id)
    db.vat_returns.getAll().forEach(v => {
      if (v.invoiceId === inv.id || v.invoiceNumber === inv.number) {
        db.vat_returns.delete(v.id)
      }
    })
    load()
    success('Invoice Deleted', `${inv.number} has been deleted.`)
  }

  const handleDownloadPDF = async (inv: any) => {
    const { invoiceApi } = await import('@/lib/api')
    const user = useAuthStore.getState().user
    try {
      const payload: any = {
        invoice_number: inv.number,
        number: inv.number,
        issue_date: inv.date,
        due_date: inv.dueDate,
        total: Number(inv.amount) || 0,
        subtotal: Number(inv.subtotal) || 0,
        tax_total: Number(inv.tax) || 0,
        advance_payment: Number(inv.advancePayment) || 0,
        currency: inv.currency || 'GBP',
        status: String(inv.status || '').toUpperCase(),
        notes: inv.notes || '',
        items: (inv.items || []).map((i: any) => {
          const unitPrice = Number(i.unitPrice ?? i.unit_price ?? i.price) || 0
          return {
            description: i.description || '',
            quantity: Number(i.quantity) || 1,
            unit_price: unitPrice,
            total: (Number(i.quantity) || 1) * unitPrice,
            tax_rate: Number(i.taxRate ?? i.tax_rate) || 0,
          }
        }),
        client: { name: inv.client || '', email: '', address: '' },
      }
      if (user) {
        payload.company_name = user.name || user.company_name || ''
        if (user.email) payload.company_email = user.email
        if (user.address) payload.company_address = user.address
        if (user.vat_number) payload.vat_number = user.vat_number
        if (user.avatar) payload.company_logo = user.avatar
      }
      const res = await invoiceApi.exportPdf(payload)
      const token = res.data?.data?.token
      if (!token) throw new Error('No download token returned from server')
      const url = invoiceApi.pdfDownloadUrl(token)
      const a = document.createElement('a')
      a.href = url
      a.download = res.data?.data?.filename || `Invoice_${inv.number}.pdf`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      success('PDF Downloaded', `Invoice ${inv.number} has been downloaded.`)
    } catch (e) {
      console.error('PDF download failed:', e)
      error('Download Failed', 'Could not generate the PDF. Please try again.')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Create, manage, and track your invoices and payments.</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 flex overflow-x-auto no-scrollbar justify-start w-full">
            <TabsTrigger value="list" className="shrink-0">All Invoices ({invoices.length})</TabsTrigger>
            <TabsTrigger value="create" className="shrink-0">{editingInvoice ? 'Edit Invoice' : 'Create New'}</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <Card className="border-none shadow-md overflow-hidden w-full">
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto">
                  <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Invoice #</TableHead>
                          <TableHead className="min-w-[150px]">Client</TableHead>
                          <TableHead className="min-w-[120px] hidden sm:table-cell">Date</TableHead>
                          <TableHead className="min-w-[120px] hidden md:table-cell">Due Date</TableHead>
                          <TableHead className="min-w-[100px]">Amount</TableHead>
                          <TableHead className="min-w-[100px]">Status</TableHead>
                          <TableHead className="text-right min-w-[120px] md:min-w-[200px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.length > 0 ? invoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell>
                              <div className="font-medium">{inv.number}</div>
                              <div className="text-xs text-muted-foreground sm:hidden">{inv.client}</div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">{inv.client}</TableCell>
                            <TableCell className="hidden sm:table-cell">{formatDate(inv.date)}</TableCell>
                            <TableCell className="hidden md:table-cell text-red-600 dark:text-red-400 font-medium">{formatDate(inv.dueDate)}</TableCell>
                            <TableCell>
                              <div>{formatCurrency(inv.amount)}</div>
                              {inv.advancePayment > 0 && (
                                <div className="text-xs text-emerald-600 font-medium">Due: {formatCurrency(Math.max(0, inv.amount - inv.advancePayment))}</div>
                              )}
                            </TableCell>
                            <TableCell><Badge variant={statusVariant(inv.status) as any}>{inv.status}</Badge></TableCell>
                            <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal size={18} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {inv.status !== 'Paid' && (
                                  <DropdownMenuItem onClick={() => markAsPaid(inv)}>
                                    Mark as Paid
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleDownloadPDF(inv)}>
                                  Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditClick(inv)}>
                                  Edit Invoice
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-rose-600 gap-2 cursor-pointer" onClick={() => handleDeleteInvoice(inv)}>
                                  <Trash2 size={14} /> Delete Invoice
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            No invoices yet. Click "Create New" to get started.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            {/* The key forces a full re-render of DocumentBuilder when switching between Edit/Create to reset state properly */}
            <DocumentBuilder
              key={editingInvoice ? editingInvoice.id : 'new'}
              type="invoice"
              initialData={editingInvoice}
              initialNumber={!editingInvoice ? `INV-${String(invoices.length + 1).padStart(3, '0')}` : undefined}
              onSave={handleSave}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
