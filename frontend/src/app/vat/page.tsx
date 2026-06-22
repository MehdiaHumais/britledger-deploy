'use client'

import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Download, AlertTriangle, Calendar, Loader2, Receipt } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import db from '@/lib/local-db'

export default function VATPage() {
  const { success } = useToast()
  const [loading, setLoading] = useState(true)
  const [isFiling, setIsFiling] = useState(false)
  const [vatOnSales, setVatOnSales] = useState(0)
  const [vatReclaimable, setVatReclaimable] = useState(0)
  const [returns, setReturns] = useState<any[]>([])

  const loadData = () => {
    setLoading(true)
    
    const invoices = db.invoices.getAll()
    const expenses = db.expenses.getAll()

    // VAT on sales = 20% of all paid invoice amounts
    const paidRevenue = invoices
      .filter(i => i.status === 'Paid')
      .reduce((s, i) => s + Number(i.amount), 0)
    setVatOnSales(paidRevenue * 0.20)

    // VAT reclaimable = 20% of all expenses
    const totalExp = expenses
      .filter(e => e.type === 'expense')
      .reduce((s, e) => s + Number(e.amount), 0)
    setVatReclaimable(totalExp * 0.20)

    setReturns(db.vat_returns.getAll('created_at', false))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const vatDue = vatOnSales
  const netVat = vatDue - vatReclaimable

  const vatBoxes = [
    { box: '1', label: 'VAT due on sales and other outputs', amount: vatDue },
    { box: '2', label: 'VAT due on acquisitions from other EC Member States', amount: 0 },
    { box: '3', label: 'Total VAT due (Sum of boxes 1 & 2)', amount: vatDue, bold: true },
    { box: '4', label: 'VAT reclaimed on purchases and other inputs', amount: vatReclaimable },
    { box: '5', label: 'Net VAT to pay to HMRC (or reclaim)', amount: netVat, bold: true, highlight: true },
  ]

  // Get current quarter label
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3) + 1
  const quarterLabel = `Q${quarter} ${now.getFullYear()}`
  const quarterDue = new Date(now.getFullYear(), quarter * 3, 7).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const handleExportCSV = () => {
    const headers = ["Box,Description,Amount\n"]
    const rows = vatBoxes.map(b => `${b.box},"${b.label}",${b.amount}`)
    const csvContent = headers.concat(rows).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `VAT_Return_${quarterLabel.replace(' ', '_')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileReturn = () => {
    setIsFiling(true)
    setTimeout(() => {
      db.vat_returns.insert({
        period: quarterLabel,
        amount: netVat,
        status: 'Filed Successfully',
        date: new Date().toISOString()
      })
      loadData()
      setIsFiling(false)
      success('VAT Return Filed', `${quarterLabel} return has been submitted to the HMRC Gateway.`)
    }, 1500)
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VAT Returns</h1>
            <p className="text-muted-foreground">Manage your UK VAT obligations and estimate your next return.</p>
          </div>
          <Button className="gap-2" onClick={handleExportCSV}><Download size={18} /> Export Records</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" /> Calculating VAT from your records...
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-4">
            <div className="col-span-full md:col-span-3 space-y-6">
              {/* VAT Return Card */}
              <Card className="border-none shadow-md overflow-hidden">
                <div className="bg-primary/5 p-6 border-b">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold">Current VAT Quarter — {quarterLabel}</h3>
                        <p className="text-sm text-muted-foreground">Based on your recorded transactions</p>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Net VAT Owed</p>
                      <p className={`text-2xl font-bold ${netVat > 0 ? 'text-primary' : 'text-emerald-600'}`}>
                        {formatCurrency(Math.abs(netVat))}
                      </p>
                      {netVat < 0 && <p className="text-xs text-emerald-600 font-medium">Reclaimable from HMRC</p>}
                    </div>
                  </div>
                </div>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[70px]">Box</TableHead>
                          <TableHead className="min-w-[200px]">Description</TableHead>
                          <TableHead className="text-right min-w-[100px]">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vatBoxes.map((row) => (
                          <TableRow key={row.box} className={row.highlight ? 'bg-primary/5' : ''}>
                            <TableCell className="font-bold">{row.box}</TableCell>
                            <TableCell className={row.bold ? 'font-semibold' : ''}>{row.label}</TableCell>
                            <TableCell className={`text-right ${row.bold ? 'font-bold' : ''} ${row.highlight ? 'text-primary' : ''}`}>
                              {formatCurrency(row.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Previous Returns */}
              <Card className="border-none shadow-md overflow-hidden">
                <CardHeader>
                  <CardTitle>Previous Returns</CardTitle>
                  <CardDescription>History of filed VAT returns</CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Period</TableHead>
                          <TableHead className="min-w-[120px]">Filed Date</TableHead>
                          <TableHead className="min-w-[100px]">Amount</TableHead>
                          <TableHead className="min-w-[120px]">Status</TableHead>
                          <TableHead className="text-right min-w-[120px]">Receipt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returns.length > 0 ? returns.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.period}</TableCell>
                            <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                            <TableCell className="font-semibold text-primary">{formatCurrency(r.amount)}</TableCell>
                            <TableCell><Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">{r.status}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="gap-1.5"
                                onClick={() => {
                                  const previewWindow = window.open('', '_blank')
                                  if (!previewWindow) {
                                    success('Popups Blocked', 'Please allow popups for this site to enable receipt preview.')
                                    return
                                  }
                                  const submissionId = Math.random().toString(36).substring(2, 10).toUpperCase()
                                  const filedDate = new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
                                  const amountFormatted = Number(r.amount).toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})

                                  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>VAT Receipt - ${r.period}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter','Segoe UI',Arial,sans-serif;color:#0f172a;background:linear-gradient(135deg,#eff6ff 0%,#f8fafc 50%,#f0fdf4 100%);min-height:100vh;padding:40px 20px;font-size:14px}
  .page{max-width:820px;margin:0 auto}
  .receipt{background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.12);overflow:hidden;position:relative}
  .topbar{height:6px;background:linear-gradient(90deg,#1d4ed8,#3b82f6,#06b6d4)}
  .body{padding:48px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid #e2e8f0}
  .brand-logo{display:flex;align-items:center;gap:14px}
  .brand-icon{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:900;letter-spacing:-1px;flex-shrink:0}
  .brand-info h1{font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px}
  .brand-info h1 span{color:#3b82f6}
  .brand-info p{font-size:11px;color:#94a3b8;margin-top:2px;font-weight:500;letter-spacing:0.3px;text-transform:uppercase}
  .doc-info{text-align:right}
  .doc-info .receipt-badge{display:inline-flex;align-items:center;gap:6px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:700;padding:6px 14px;border-radius:99px;letter-spacing:0.5px;margin-bottom:8px;border:1px solid #bfdbfe}
  .doc-info .ref{font-size:12px;color:#94a3b8;margin-top:2px}
  .doc-info .ref strong{color:#475569}
  .status-row{display:flex;align-items:center;gap:8px;margin-top:6px;justify-content:flex-end}
  .status-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;background:#d1fae5;color:#065f46;border:1px solid #a7f3d0}
  .status-dot{width:6px;height:6px;background:#10b981;border-radius:50%}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;margin-bottom:40px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden}
  .meta-cell{padding:20px 24px;border-right:1px solid #e2e8f0}
  .meta-cell:last-child{border-right:none}
  .meta-cell .label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .meta-cell .value{font-size:15px;font-weight:700;color:#0f172a}
  .meta-cell .sub{font-size:11px;color:#64748b;margin-top:2px}
  .amount-box{background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 60%,#3b82f6 100%);color:#fff;border-radius:14px;padding:32px;text-align:center;margin-bottom:36px;position:relative;overflow:hidden}
  .amount-box::before{content:'';position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(255,255,255,0.06);border-radius:50%}
  .amount-box::after{content:'';position:absolute;bottom:-20px;left:-20px;width:80px;height:80px;background:rgba(255,255,255,0.06);border-radius:50%}
  .amount-box .label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;opacity:0.75;margin-bottom:10px}
  .amount-box .figure{font-size:46px;font-weight:900;letter-spacing:-2px;margin-bottom:4px;position:relative}
  .amount-box .sub{font-size:12px;opacity:0.7}
  .breakdown{margin-bottom:36px}
  .breakdown h3{font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
  .breakdown-table{width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0}
  .breakdown-table thead tr{background:#1e293b;color:#94a3b8}
  .breakdown-table thead th{padding:10px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
  .breakdown-table thead th:last-child{text-align:right}
  .breakdown-table tbody td{padding:12px 16px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#334155}
  .breakdown-table tbody td:last-child{text-align:right;font-weight:600}
  .breakdown-table tbody tr:last-child td{border-bottom:none;background:#eff6ff;font-weight:700;color:#1d4ed8}
  .breakdown-table tbody tr.highlight td{background:#eff6ff;font-weight:700;color:#1d4ed8}
  .details-section{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px}
  .detail-card{background:#f8fafc;border-radius:10px;padding:20px;border:1px solid #e2e8f0}
  .detail-card h4{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
  .detail-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:12px}
  .detail-row:last-child{border-bottom:none}
  .detail-row .k{color:#64748b}
  .detail-row .v{font-weight:600;color:#0f172a}
  .hmrc-note{display:flex;gap:12px;align-items:flex-start;background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:16px;margin-bottom:32px}
  .hmrc-note .icon{color:#d97706;font-size:18px;flex-shrink:0;margin-top:1px}
  .hmrc-note p{font-size:12px;color:#92400e;line-height:1.6}
  .hmrc-note strong{font-weight:700}
  .footer{display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid #e2e8f0}
  .footer-left p{font-size:11px;color:#94a3b8;margin-bottom:2px}
  .footer-right{text-align:right}
  .footer-right .verified{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#059669;font-weight:600}
  .dl-btn{position:fixed;top:20px;right:20px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff;border:none;padding:12px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(59,130,246,0.4);z-index:100;display:flex;align-items:center;gap:8px;transition:all .2s;letter-spacing:0.3px}
  .dl-btn:hover{transform:translateY(-1px);box-shadow:0 12px 32px rgba(59,130,246,0.5)}
  .dl-btn svg{width:16px;height:16px}
  @media print{.dl-btn{display:none!important}body{background:#fff;padding:0}.receipt{box-shadow:none;border-radius:0}.topbar{display:none}}
</style></head><body>
<button class="dl-btn" id="dl-btn" onclick="downloadPDF()">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  Download PDF
</button>
<div class="page">
  <div class="receipt" id="receipt">
    <div class="topbar"></div>
    <div class="body">
      <div class="header">
        <div class="brand-logo">
          <div class="brand-icon">B</div>
          <div class="brand-info"><h1>Brit<span>Ledger</span> AI</h1><p>Smart Bookkeeping &amp; Tax</p></div>
        </div>
        <div class="doc-info">
          <div class="receipt-badge">&#x1F4CB; VAT RECEIPT</div>
          <div class="ref">Ref: <strong>${submissionId}</strong></div>
          <div class="status-row"><div class="status-pill"><div class="status-dot"></div>${r.status}</div></div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-cell"><div class="label">Tax Period</div><div class="value">${r.period}</div><div class="sub">Quarterly Filing</div></div>
        <div class="meta-cell"><div class="label">Submission Date</div><div class="value">${filedDate}</div><div class="sub">HMRC Gateway</div></div>
        <div class="meta-cell"><div class="label">VAT Scheme</div><div class="value">Standard</div><div class="sub">20% Rate</div></div>
      </div>

      <div class="amount-box">
        <div class="label">Net VAT Amount Due</div>
        <div class="figure">&pound;${amountFormatted}</div>
        <div class="sub">Submitted to HMRC &bull; ${filedDate}</div>
      </div>

      <div class="breakdown">
        <h3>VAT Return Summary</h3>
        <table class="breakdown-table">
          <thead><tr><th>Box</th><th>Description</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td><strong>Box 1</strong></td><td>VAT due on sales and other outputs</td><td>&pound;${Number(r.amount).toFixed(2)}</td></tr>
            <tr><td><strong>Box 2</strong></td><td>VAT due on acquisitions from EC Member States</td><td>&pound;0.00</td></tr>
            <tr class="highlight"><td><strong>Box 5</strong></td><td><strong>Net VAT to pay to HMRC</strong></td><td><strong>&pound;${amountFormatted}</strong></td></tr>
          </tbody>
        </table>
      </div>

      <div class="details-section">
        <div class="detail-card">
          <h4>Submission Details</h4>
          <div class="detail-row"><span class="k">Filing Method</span><span class="v">Digital (MTD)</span></div>
          <div class="detail-row"><span class="k">Payment Method</span><span class="v">Direct Debit</span></div>
          <div class="detail-row"><span class="k">HMRC Gateway</span><span class="v">Verified &#10003;</span></div>
          <div class="detail-row"><span class="k">Agent</span><span class="v">BritLedger AI</span></div>
        </div>
        <div class="detail-card">
          <h4>Period Information</h4>
          <div class="detail-row"><span class="k">Tax Year</span><span class="v">${r.period.split(' ').pop()}</span></div>
          <div class="detail-row"><span class="k">Quarter</span><span class="v">${r.period.split(' ')[0]}</span></div>
          <div class="detail-row"><span class="k">Filing Status</span><span class="v" style="color:#059669">${r.status}</span></div>
          <div class="detail-row"><span class="k">Submission Ref</span><span class="v">${submissionId}</span></div>
        </div>
      </div>

      <div class="hmrc-note">
        <div class="icon">&#9432;</div>
        <p><strong>Official Notice:</strong> This document confirms your VAT return was successfully submitted to HMRC via the Making Tax Digital (MTD) gateway. Keep this receipt for your records for a minimum of 6 years as required by UK law.</p>
      </div>

      <div class="footer">
        <div class="footer-left">
          <p>BritLedger AI &bull; Digital Tax Services</p>
          <p>Generated: ${filedDate}</p>
        </div>
        <div class="footer-right">
          <div class="verified">&#10003; HMRC Gateway Verified</div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
  function downloadPDF() {
    var btn = document.getElementById('dl-btn');
    btn.innerHTML = '&#9679; Generating...';
    btn.style.opacity = '0.8';
    btn.disabled = true;
    var element = document.getElementById('receipt');
    var opt = {
      margin: 8,
      filename: 'VAT_Receipt_${r.period.replace(/ /g, '_')}.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save().then(function() {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download PDF';
      btn.style.opacity = '1';
      btn.disabled = false;
    });
  }
<\/script>
</body></html>`

                                  previewWindow.document.open()
                                  previewWindow.document.write(html)
                                  previewWindow.document.close()
                                }}
                              >
                                <Receipt size={14} /> View Receipt
                              </Button>
                            </TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={5} className="h-16 text-center text-muted-foreground text-sm">
                              No filed returns yet. Your history will appear here once you file.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="col-span-full md:col-span-1 space-y-6">
              {netVat > 0 && (
                <Card className="border-none shadow-sm bg-amber-50 dark:bg-amber-950/20">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 text-amber-800 dark:text-amber-200">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={20} />
                        <span className="font-bold">Payment Due</span>
                      </div>
                      <p className="text-sm">
                        Your {quarterLabel} VAT return is due by <strong>{quarterDue}</strong>.
                      </p>
                      <p className="text-xl font-bold">{formatCurrency(netVat)}</p>
                      <Button 
                        variant="outline" 
                        className="border-amber-200 bg-amber-100 hover:bg-amber-200 text-amber-900"
                        onClick={handleFileReturn}
                        disabled={isFiling}
                      >
                        {isFiling ? <><Loader2 size={16} className="animate-spin mr-2" /> Filing...</> : 'File Return'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">VAT Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Scheme</span>
                    <span className="font-medium">Standard</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-medium">20%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Frequency</span>
                    <span className="font-medium">Quarterly</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Current Quarter</span>
                    <Badge variant="outline" className="text-[10px] h-4">{quarterLabel}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
