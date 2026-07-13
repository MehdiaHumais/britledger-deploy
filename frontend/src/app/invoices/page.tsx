'use client'

import React, { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { DocumentBuilder } from '@/components/finance/document-builder'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, MoreHorizontal, Edit2, Trash2, Loader2, FileText } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useToast } from '../../components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import db from '@/lib/local-db'

export default function InvoicesPage() {
  const { success, error } = useToast()
  const [invoices, setInvoices] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('list')
  const [editingInvoice, setEditingInvoice] = useState<any>(null)
  const [deletingInvoice, setDeletingInvoice] = useState<any>(null)

  const load = () => setInvoices(db.invoices.getAll('created_at', false))
  useEffect(() => { load() }, [])

  const handleSave = (data: any) => {
    const payload: any = {
      number: data.documentNumber,
      client: data.clientName,
      clientId: data.clientId,
      date: data.date,
      dueDate: data.dueDate,
      amount: data.total,
      subtotal: data.subtotal,
      tax: data.totalTax,
      status: editingInvoice ? editingInvoice.status : 'Sent',
      items: data.items,
      notes: data.notes
    }
    if (data.backendId) {
      payload.backendId = data.backendId
    }

    if (editingInvoice) {
      db.invoices.update(editingInvoice.id, payload)
      success('Invoice Updated', `${data.documentNumber} has been updated successfully.`)
    } else {
      db.invoices.insert(payload)
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

  const markAsPaid = (inv: any) => {
    db.invoices.update(inv.id, { status: 'Paid' })
    db.notifications.insert({
      title: 'Payment Received',
      message: `Payment confirmed for invoice ${inv.number}.`,
      date: new Date().toISOString(),
      isRead: false
    })
    load()
    success('Marked as Paid', 'Invoice status updated to Paid.')
  }

  const handleDeleteInvoice = (inv: any) => {
    db.invoices.delete(inv.id)
    db.vat_returns.getAll().forEach(v => {
      if (v.invoiceId === inv.id || v.invoiceNumber === inv.number) {
        db.vat_returns.delete(v.id)
      }
    })
    load()
    success('Invoice Deleted', `${inv.number} has been deleted.`)
  }

  const [pdfPreview, setPdfPreview] = useState<any>(null)

  const handleDownloadPDF = (inv: any) => {
    setPdfPreview(inv)
  }

  const closePdf = () => setPdfPreview(null)

  const itemRowsHtml = (inv: any) => (inv.items || []).map((i: any) => {
    const lineTotal = (i.quantity || 1) * (i.price || i.unit_price || 0)
    return `<tr>
      <td>${i.description || ''}</td>
      <td class="center">${i.quantity || 1}</td>
      <td class="right">£${Number(i.price || i.unit_price || 0).toFixed(2)}</td>
      <td class="right">£${lineTotal.toFixed(2)}</td>
    </tr>`
  }).join('')


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
                            <TableCell>{formatCurrency(inv.amount)}</TableCell>
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

      {pdfPreview && (
        <Dialog open={!!pdfPreview} onOpenChange={() => closePdf()}>
          <DialogContent className="max-w-3xl w-[95vw] h-[90vh] max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Invoice {pdfPreview.number}</h2>
              <div className="flex gap-2">
                <Button size="sm" onClick={closePdf}>Close</Button>
              </div>
            </div>
            <iframe
              srcDoc={`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Invoice ${pdfPreview.number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#f1f5f9;padding:20px;font-size:13px}
  .doc-card{background:#fff;max-width:800px;margin:0 auto;padding:30px;border-radius:8px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1)}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #3b82f6}
  .brand h1{font-size:22px;font-weight:800;color:#1e3a5f}.brand h1 span{color:#3b82f6}
  .doc-label{text-align:right}.doc-label h2{font-size:26px;font-weight:900;color:#3b82f6;letter-spacing:2px}
  .doc-label p{font-size:12px;color:#64748b;margin-top:4px}
  .status{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${pdfPreview.status==='Paid'?'#d1fae5;color:#059669':pdfPreview.status==='Overdue'?'#fee2e2;color:#dc2626':'#dbeafe;color:#1d4ed8'}}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
  .meta-box h4{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .meta-box p{font-size:13px;color:#1e293b;margin-bottom:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  thead tr{background:#1e3a5f;color:#fff}
  thead th{padding:10px 12px;text-align:left;font-size:12px;font-weight:600}
  tbody tr:nth-child(even){background:#f8fafc}
  tbody td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
  .center{text-align:center}.right{text-align:right}
  .totals{margin-left:auto;width:240px}
  .totals td{padding:6px 12px;font-size:12px}
  .totals .total-row td{font-size:15px;font-weight:800;color:#3b82f6;border-top:2px solid #3b82f6;padding-top:10px}
  .notes{margin-top:24px;padding:12px;background:#f8fafc;border-radius:8px;border-left:3px solid #3b82f6}
  .notes h4{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
  .footer{margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px}
  @media print{body{background:#fff;padding:0}.doc-card{box-shadow:none}}
</style></head><body>
  <div class="doc-card">
    <div class="header">
      <div class="brand"><h1>Brit<span>Ledger</span> AI</h1></div>
      <div class="doc-label"><h2>INVOICE</h2><p>${pdfPreview.number}</p><span class="status">${pdfPreview.status}</span></div>
    </div>
    <div class="meta-grid">
      <div><div class="meta-box"><h4>Bill To</h4><p class="highlight">${pdfPreview.client}</p></div></div>
      <div><div class="meta-box"><h4>Details</h4>
        <p>Invoice #: <strong>${pdfPreview.number}</strong></p>
        <p>Issue Date: <strong>${pdfPreview.date || ''}</strong></p>
        ${pdfPreview.dueDate ? `<p>Due Date: <strong style="color:#ef4444">${pdfPreview.dueDate}</strong></p>` : ''}
      </div></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="center">Qty</th><th class="right">Unit Price</th><th class="right">Amount</th></tr></thead>
      <tbody>${itemRowsHtml(pdfPreview) || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px">No line items</td></tr>'}</tbody>
    </table>
    <div class="totals"><table>
      <tr><td style="color:#64748b">Subtotal</td><td class="right">£${Number(pdfPreview.subtotal || pdfPreview.amount || 0).toFixed(2)}</td></tr>
      <tr><td style="color:#64748b">VAT</td><td class="right">£${Number(pdfPreview.tax || 0).toFixed(2)}</td></tr>
      <tr class="total-row"><td>Total Due</td><td class="right">£${Number(pdfPreview.amount || 0).toFixed(2)}</td></tr>
    </table></div>
    ${pdfPreview.notes ? `<div class="notes"><h4>Notes</h4><p>${pdfPreview.notes}</p></div>` : ''}
    <div class="footer"><p>Generated by BritLedger AI</p></div>
  </div>
</body></html>`}
              className="w-full h-full border-0 rounded-lg"
              style={{ minHeight: '70vh' }}
            />
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  )
}
