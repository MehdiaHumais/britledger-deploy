'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Send, Save, FileText, AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
import { formatCurrency, calculateVAT } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import db from '@/lib/local-db'

interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
}

interface DocumentBuilderProps {
  type: 'invoice' | 'quotation'
  initialNumber?: string
  initialData?: any
  onSave: (data: any) => void
}

export function DocumentBuilder({ type, initialNumber, initialData, onSave }: DocumentBuilderProps) {
  const { success, error: toastError, warning } = useToast()
  const [documentNumber, setDocumentNumber] = useState(initialData?.number || initialNumber || '')
  const [selectedClientId, setSelectedClientId] = useState(initialData?.clientId || '')
  const [clientName, setClientName] = useState(initialData?.clientName || initialData?.client || '')
  const [clients, setClients] = useState<any[]>([])
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(initialData?.dueDate || '')
  const [items, setItems] = useState<LineItem[]>(initialData?.items || [
    { id: '1', description: '', quantity: 1, unitPrice: 0, taxRate: 20 }
  ])
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [discount, setDiscount] = useState(initialData?.discount || 0)
  const [formError, setFormError] = useState('')

  // Load real clients from local-db
  useEffect(() => {
    const allClients = db.clients.getAll('created_at', false)
    setClients(allClients)
    // If editing, make sure the client name matches the saved clientId
    if (initialData?.clientId) {
      const c = allClients.find((c: any) => c.id === initialData.clientId)
      if (c) setClientName(c.name)
    }
  }, [initialData])

  const selectClient = (client: any) => {
    setSelectedClientId(client.id)
    setClientName(client.name)
    setClientDropdownOpen(false)
    setFormError('')
  }

  const addItem = () => {
    setItems([...items, {
      id: Math.random().toString(36).substr(2, 9),
      description: '', quantity: 1, unitPrice: 0, taxRate: 20
    }])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter(i => i.id !== id))
  }

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const totalTax = items.reduce((s, i) => s + calculateVAT(i.quantity * i.unitPrice, i.taxRate), 0)
  const total = Math.max(0, subtotal + totalTax - discount)

  const validate = (): boolean => {
    if (!selectedClientId) {
      setFormError('Please select a client from the list.')
      return false
    }
    if (!documentNumber.trim()) {
      setFormError(`Please enter a ${type} number.`)
      return false
    }
    if (items.some(i => !i.description.trim())) {
      setFormError('All line items must have a description.')
      return false
    }
    if (total <= 0 && items.length === 0) {
      setFormError('Total amount must be greater than £0.')
      return false
    }
    setFormError('')
    return true
  }

  const handleSave = () => {
    if (!validate()) return
    setIsSaving(true)
    setTimeout(() => {
      onSave({ documentNumber, clientName, clientId: selectedClientId, items, total, subtotal, totalTax, discount, notes, date, dueDate })
      setIsSaving(false)
    }, 600)
  }

  const [isSending, setIsSending] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleSend = async () => {
    if (!validate()) return
    const client = clients.find(c => c.id === selectedClientId)
    const email = client?.email

    if (!email) {
      setFormError('Selected client does not have an email address.')
      return
    }

    setIsSending(true)
    try {
      const { invoiceApi, quotationApi, clientApi } = await import('@/lib/api')
      const api = type === 'invoice' ? invoiceApi : quotationApi

      // 1. Ensure Client exists in Backend
      let clientBackendId = selectedClientId
      try {
        await clientApi.get(selectedClientId)
      } catch (clientErr) {
        const c = clients.find(c => c.id === selectedClientId)
        if (c) {
          const createRes = await clientApi.create({
            name: c.name,
            email: c.email,
            address: c.address,
            phone: c.phone || ""
          })
          clientBackendId = createRes.data.data.id
        }
      }

      // 2. Sync document to backend if not already synced
      let backendId = initialData?.backendId
      if (!backendId) {
         const saveRes = await api.create({
            client_id: clientBackendId,
            [type === 'invoice' ? 'invoice_number' : 'quotation_number']: documentNumber,
            issue_date: date,
            [type === 'invoice' ? 'due_date' : 'expiry_date']: dueDate || null,
            total_amount: total,
            subtotal: subtotal,
            tax: totalTax,
            currency: 'GBP',
            items: items.map(i => ({
              description: i.description,
              quantity: i.quantity,
              unit_price: i.unitPrice,
              tax_rate: i.taxRate
            })),
            notes: notes
         })
         backendId = saveRes.data.data.id
      }

      const response = await api.send(backendId, {
        to_email: email,
        subject: `Your ${type} from BritLedger AI (${documentNumber})`,
        personal_message: `Hello ${clientName}, please find your ${type} details below.`
      })

      if (response.data.success || response.status === 200) {
        success('Email Sent', `Professional ${type} sent to ${email}.`)
        onSave({ documentNumber, clientName, clientId: selectedClientId, items, total, subtotal, totalTax, discount, notes, date, dueDate, status: 'Sent', backendId })
      } else {
        setFormError(`Failed to send email via backend.`)
      }
    } catch (err: any) {
      console.error("Send Error:", err)
      const status = err.response?.status
      const data = err.response?.data
      const errorMsg = err.response?.data?.detail || err.message || 'An error occurred while sending.'
      const detail = status ? `[${status}] ${errorMsg}` : errorMsg
      setFormError(`Server Error: ${detail}`)
      toastError('Send Failed', detail)
    } finally {
      setIsSending(false)
    }
  }

  const handlePreviewPDF = () => {
    if (!validate()) return

    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      warning('Popups Blocked', 'Please allow popups for this site to enable PDF preview.')
      return
    }

    const docTitle = type === 'invoice' ? 'INVOICE' : 'QUOTATION'
    const clientEmail = clients.find(c => c.id === selectedClientId)?.email || ''
    const clientPhone = (clients.find(c => c.id === selectedClientId) as any)?.phone || ''
    const now = new Date()
    const issuedDateStr = date || now.toISOString().split('T')[0]

    const itemRowsHtml = items.map(item => {
      const lineTotal = item.quantity * item.unitPrice
      return `
        <tr>
          <td>${item.description}</td>
          <td class="center">${item.quantity}</td>
          <td class="right">\u00a3${item.unitPrice.toFixed(2)}</td>
          <td class="center">${item.taxRate}%</td>
          <td class="right">\u00a3${lineTotal.toFixed(2)}</td>
        </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${docTitle} ${documentNumber}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#f1f5f9;padding:40px;font-size:14px}
    .doc-card{background:#fff;max-width:850px;margin:0 auto;padding:50px;border-radius:8px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1)}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:3px solid #3b82f6}
    .brand h1{font-size:28px;font-weight:800;color:#1e3a5f}.brand h1 span{color:#3b82f6}
    .brand p{font-size:12px;color:#64748b;margin-top:2px}
    .doc-label{text-align:right}.doc-label h2{font-size:32px;font-weight:900;color:#3b82f6;letter-spacing:2px}
    .doc-label p{font-size:13px;color:#64748b;margin-top:4px}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px}
    .meta-box h4{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
    .meta-box p{font-size:14px;color:#1e293b;margin-bottom:2px}
    .meta-box .highlight{font-weight:700;font-size:15px}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    thead tr{background:#1e3a5f;color:#fff}
    thead th{padding:12px 14px;text-align:left;font-size:13px;font-weight:600}
    tbody tr:nth-child(even){background:#f8fafc}
    tbody td{padding:11px 14px;border-bottom:1px solid #e2e8f0;font-size:13px}
    .center{text-align:center}.right{text-align:right}
    .totals{margin-left:auto;width:280px}
    .totals table{margin-bottom:0}
    .totals td{padding:8px 12px;font-size:13px}
    .totals .total-row td{font-size:16px;font-weight:800;color:#3b82f6;border-top:2px solid #3b82f6;padding-top:12px}
    .notes{margin-top:32px;padding:16px;background:#f8fafc;border-radius:8px;border-left:3px solid #3b82f6}
    .notes h4{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
    .notes p{font-size:13px;color:#475569}
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:11px}
    .download-btn{position:fixed;top:20px;right:20px;background:#3b82f6;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,0.4);z-index:100;display:flex;align-items:center;gap:8px}
    .download-btn:hover{background:#2563eb}
    @media print{.download-btn{display:none!important}body{background:#fff;padding:0}.doc-card{box-shadow:none}}
  </style>
</head>
<body>
  <button class="download-btn" id="dl-btn" onclick="downloadPDF()">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
    Download PDF
  </button>
  <div class="doc-card" id="doc-content">
    <div class="header">
      <div class="brand"><h1>Brit<span>Ledger</span> AI</h1><p>Smart Bookkeeping &amp; Invoicing</p></div>
      <div class="doc-label"><h2>${docTitle}</h2><p>${documentNumber}</p></div>
    </div>
    <div class="meta-grid">
      <div><div class="meta-box"><h4>Bill To</h4><p class="highlight">${clientName}</p>${clientEmail ? `<p>${clientEmail}</p>` : ''}${clientPhone ? `<p>${clientPhone}</p>` : ''}</div></div>
      <div><div class="meta-box"><h4>Details</h4><p>${docTitle} #: <strong>${documentNumber}</strong></p><p>Issue Date: <strong>${issuedDateStr}</strong></p>${dueDate ? `<p>Due Date: <strong style="color:#ef4444">${dueDate}</strong></p>` : ''}</div></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="center">Qty</th><th class="right">Unit Price</th><th class="center">VAT %</th><th class="right">Amount</th></tr></thead>
      <tbody>${itemRowsHtml}</tbody>
    </table>
    <div class="totals"><table>
      <tr><td style="color:#64748b">Subtotal</td><td class="right">\u00a3${subtotal.toFixed(2)}</td></tr>
      <tr><td style="color:#64748b">VAT</td><td class="right">\u00a3${totalTax.toFixed(2)}</td></tr>
      ${discount > 0 ? `<tr><td style="color:#64748b">Discount</td><td class="right" style="color:#ef4444">-\u00a3${discount.toFixed(2)}</td></tr>` : ''}
      <tr class="total-row"><td>Total Due</td><td class="right">\u00a3${total.toFixed(2)}</td></tr>
    </table></div>
    ${notes ? `<div class="notes"><h4>Notes / Terms</h4><p>${notes}</p></div>` : ''}
    <div class="footer"><p>Generated by BritLedger AI &bull; ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p><p style="margin-top:4px">Thank you for your business!</p></div>
  </div>
  <script>
    function downloadPDF() {
      const btn = document.getElementById('dl-btn');
      btn.style.display = 'none';
      const element = document.getElementById('doc-content');
      const opt = {
        margin: 10,
        filename: '${docTitle}_${documentNumber}.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save().then(() => {
        btn.style.display = 'flex';
      });
    }
  </script>
</body></html>`

    previewWindow.document.open()
    previewWindow.document.write(html)
    previewWindow.document.close()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6 min-w-0">
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle>{type === 'invoice' ? 'Invoice Details' : 'Quotation Details'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Error banner */}
            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                <AlertCircle size={16} className="shrink-0" />
                {formError}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {/* Client selector */}
              <div className="space-y-2 relative">
                <label className="text-sm font-medium">
                  Client <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                  className={`flex items-center justify-between w-full h-10 px-3 rounded-md border text-sm bg-background transition-colors ${
                    selectedClientId 
                      ? 'border-primary text-foreground' 
                      : 'border-input text-muted-foreground'
                  } hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring`}
                >
                  <span>{clientName || 'Select a client...'}</span>
                  <ChevronDown size={16} className="shrink-0" />
                </button>

                {clientDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg overflow-hidden">
                    {clients.length > 0 ? (
                      clients.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectClient(c)}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors border-b last:border-0"
                        >
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                        No clients found.<br />
                        <a href="/clients" className="text-primary underline text-xs">Add a client first →</a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Doc number */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {type === 'invoice' ? 'Invoice #' : 'Quotation #'} <span className="text-rose-500">*</span>
                </label>
                <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Items</h3>
                <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
                  <Plus size={14} /> Add Item
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Description <span className="text-rose-500">*</span></TableHead>
                      <TableHead className="min-w-[80px]">Qty</TableHead>
                      <TableHead className="min-w-[100px]">Unit Price</TableHead>
                      <TableHead className="min-w-[80px]">Tax (%)</TableHead>
                      <TableHead className="text-right min-w-[100px]">Amount</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Input
                            placeholder="e.g. Web development"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="1" value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 1)} 
                          />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" step="0.01" value={item.unitPrice}
                            onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} 
                          />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" max="100" value={item.taxRate}
                            onChange={(e) => updateItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)} 
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50" disabled={items.length === 1}>
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes / Terms</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Payment terms, bank details, thank you note..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary sidebar */}
      <div className="space-y-6">
        <Card className="border-none shadow-md bg-slate-50 dark:bg-slate-900 lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedClientId && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Sending to</p>
                <p className="font-semibold">{clientName}</p>
                <p className="text-xs text-muted-foreground">
                  {clients.find(c => c.id === selectedClientId)?.email}
                </p>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax (VAT)</span>
              <span>{formatCurrency(totalTax)}</span>
            </div>
            <div className="flex justify-between items-center text-sm pt-2">
              <span className="text-muted-foreground">Discount (£)</span>
              <Input 
                type="number" 
                min="0" 
                step="0.01"
                className="w-20 sm:w-24 h-8 text-right" 
                value={discount} 
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} 
              />
            </div>
            <div className="border-t pt-4 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>

            <div className="pt-4 space-y-3">
              <Button className="w-full gap-2" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save {type === 'invoice' ? 'Invoice' : 'Quotation'}</>}
              </Button>
              <Button variant="outline" className="w-full gap-2 text-primary" onClick={handleSend} disabled={isSending}>
                {isSending ? <><Loader2 size={18} className="animate-spin" /> Sending...</> : <><Send size={18} /> Send to Client</>}
              </Button>
              <Button variant="ghost" className="w-full gap-2" onClick={handlePreviewPDF}>
                <FileText size={18} /> Preview PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
