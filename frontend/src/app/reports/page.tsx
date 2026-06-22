'use client'

import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { FileText, Download, TrendingUp, Filter, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import db from '@/lib/local-db'
import api from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from '@/components/ui/badge'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ReportsPage() {
  const { error, info } = useToast()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)
  const [showAiModal, setShowAiModal] = useState(false)

  useEffect(() => {
    setLoading(true)
    setInvoices(db.invoices.getAll())
    setExpenses(db.expenses.getAll())
    setLoading(false)
  }, [])

  const pAndLData = MONTH_LABELS.map((month, idx) => ({
    month,
    revenue: invoices
      .filter(i => new Date(i.date).getMonth() === idx && i.status === 'Paid')
      .reduce((s, i) => s + Number(i.amount), 0),
    expenses: expenses
      .filter(e => new Date(e.date).getMonth() === idx && e.type === 'expense')
      .reduce((s, e) => s + Number(e.amount), 0),
  }))

  const totalRevenue = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
  const grossProfit = totalRevenue - totalExpenses
  const margin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0'

  const handleExportCSV = () => {
    const headers = ["Month,Revenue,Expenses,Profit\n"]
    const rows = pAndLData.map(d => `${d.month},${d.revenue},${d.expenses},${d.revenue - d.expenses}`)
    const csvContent = headers.concat(rows).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'PnL_Report.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportPDF = (type: string) => {
    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      error('Popups Blocked', 'Please allow popups for this site to enable PDF preview.')
      return
    }
    const isProfit = type.includes('Profit')
    const year = new Date().getFullYear()
    const now = new Date()
    const monthRowsHtml = pAndLData.map(d => {
      const profit = d.revenue - d.expenses
      return `<tr>
        <td>${d.month} ${year}</td>
        <td class="right" style="color:#059669">\u00a3${d.revenue.toFixed(2)}</td>
        <td class="right" style="color:#dc2626">\u00a3${d.expenses.toFixed(2)}</td>
        <td class="right" style="color:${profit>=0?'#059669':'#dc2626'};font-weight:600">\u00a3${profit.toFixed(2)}</td>
      </tr>`
    }).join('')
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>${isProfit?'Profit &amp; Loss':'Tax Summary'} ${year}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;padding:40px;font-size:14px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:3px solid #3b82f6}.brand h1{font-size:28px;font-weight:800;color:#1e3a5f}.brand h1 span{color:#3b82f6}.brand p{font-size:12px;color:#64748b;margin-top:2px}.doc-label{text-align:right}.doc-label h2{font-size:22px;font-weight:800;color:#1e293b}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}.summary-card{background:#f8fafc;border-radius:10px;padding:20px;border-left:4px solid #3b82f6}.summary-card h4{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}.summary-card .val{font-size:24px;font-weight:800}table{width:100%;border-collapse:collapse;margin-bottom:24px}thead tr{background:#1e3a5f;color:#fff}thead th{padding:12px 14px;text-align:left;font-size:13px;font-weight:600}tbody tr:nth-child(even){background:#f8fafc}tbody td{padding:11px 14px;border-bottom:1px solid #e2e8f0;font-size:13px}tfoot tr{background:#f1f5f9;font-weight:700}tfoot td{padding:12px 14px;font-size:14px;border-top:2px solid #3b82f6}.right{text-align:right}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:11px}.print-btn{position:fixed;top:20px;right:20px;background:#3b82f6;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}.print-btn:hover{background:#2563eb}@media print{.print-btn{display:none!important}body{padding:20px}}</style></head>
<body>
<button class="print-btn" onclick="window.print()">&#128438; Print / Save as PDF</button>
<div class="header"><div class="brand"><h1>Brit<span>Ledger</span> AI</h1><p>Smart Bookkeeping &amp; Invoicing</p></div><div class="doc-label"><h2>${isProfit?'Profit &amp; Loss Statement':'Tax Summary Report'}</h2><p>Year ${year} &bull; ${now.toLocaleDateString('en-GB')}</p></div></div>
<div class="summary-grid">
  <div class="summary-card"><h4>Total Revenue</h4><div class="val" style="color:#059669">\u00a3${totalRevenue.toFixed(2)}</div></div>
  <div class="summary-card"><h4>Total Expenses</h4><div class="val" style="color:#dc2626">\u00a3${totalExpenses.toFixed(2)}</div></div>
  <div class="summary-card"><h4>Net Profit</h4><div class="val" style="color:${grossProfit>=0?'#059669':'#dc2626'}">\u00a3${grossProfit.toFixed(2)}</div></div>
</div>
<table><thead><tr><th>Period</th><th class="right">Revenue</th><th class="right">Expenses</th><th class="right">Profit/Loss</th></tr></thead>
<tbody>${monthRowsHtml}</tbody>
<tfoot><tr><td>TOTAL</td><td class="right" style="color:#059669">\u00a3${totalRevenue.toFixed(2)}</td><td class="right" style="color:#dc2626">\u00a3${totalExpenses.toFixed(2)}</td><td class="right" style="color:${grossProfit>=0?'#059669':'#dc2626'}">\u00a3${grossProfit.toFixed(2)}</td></tr></tfoot></table>
${!isProfit?`<table><thead><tr><th>VAT Summary</th><th class="right">Amount</th></tr></thead><tbody><tr><td>VAT on Revenue (20%)</td><td class="right">\u00a3${(totalRevenue*0.2/1.2).toFixed(2)}</td></tr><tr><td>VAT on Expenses (20%)</td><td class="right">\u00a3${(totalExpenses*0.2/1.2).toFixed(2)}</td></tr><tr><td style="font-weight:700">Net VAT Payable</td><td class="right" style="font-weight:700;color:#3b82f6">\u00a3${((totalRevenue-totalExpenses)*0.2/1.2).toFixed(2)}</td></tr></tbody></table>`:''}
<div class="footer"><p>BritLedger AI &bull; Profit Margin: ${margin}% &bull; Year ${year}</p></div>
</body></html>`
    previewWindow.document.open()
    previewWindow.document.write(html)
    previewWindow.document.close()
  }

  const reportLinks = [
    { title: 'Profit & Loss Statement', description: 'Summary of revenue and costs', icon: <TrendingUp size={20} /> },
    { title: 'Tax Summary', description: 'Complete tax breakdown', icon: <FileText size={20} /> },
  ]

  return (
    <>
      <DashboardLayout>
        <div className="space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
              <p className="text-muted-foreground">Detailed financial reports and business performance analytics.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => info('Coming Soon', 'Custom Date Range filtering will be available in the next release. Currently showing Year-to-Date data.')}>
                <Filter size={18} /> Custom Range
              </Button>
              <Button className="gap-2" onClick={handleExportCSV}><Download size={18} /> Export CSV</Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" /> Loading financial data...
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-none shadow-md lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Profit & Loss (Monthly)</CardTitle>
                    <CardDescription>Revenue vs Expenses — current year</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pAndLData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(v) => `£${v}`} />
                        <Tooltip formatter={(v: any) => formatCurrency(v)} />
                        <Legend />
                        <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md">
                  <CardHeader>
                    <CardTitle>Reports Library</CardTitle>
                    <CardDescription>Generate specific financial documents</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {reportLinks.map((r) => (
                      <div key={r.title}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors group"
                        onClick={() => handleExportPDF(r.title)}
                      >
                        <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                          {r.icon}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">{r.title}</h4>
                          <p className="text-xs text-muted-foreground">{r.description}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Financial Summary */}
                <Card className="border-none shadow-md">
                  <CardHeader>
                    <CardTitle>Financial Summary (YTD)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-4">
                      <span className="text-muted-foreground">Total Revenue (Paid)</span>
                      <span className="text-xl font-bold">{formatCurrency(totalRevenue)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-4">
                      <span className="text-muted-foreground">Total Expenses</span>
                      <span className="text-xl font-bold text-rose-600">{formatCurrency(totalExpenses)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-4">
                      <span className="text-muted-foreground">Gross Profit</span>
                      <span className={`text-xl font-bold ${grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(grossProfit)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="font-bold">Net Profit Margin</span>
                      <span className="text-xl font-bold text-primary">{margin}%</span>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Insights */}
                <Card className="border-none shadow-md bg-primary text-primary-foreground">
                  <CardHeader>
                    <CardTitle className="text-white">AI Insights</CardTitle>
                    <CardDescription className="text-primary-foreground/80">Intelligent business analysis</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-white/10 p-4 rounded-lg">
                      <p className="text-sm font-medium">Revenue Health</p>
                      <p className="text-xs mt-1">
                        {totalRevenue > 0
                          ? `You've collected ${formatCurrency(totalRevenue)} in paid revenue with a ${margin}% profit margin.`
                          : 'No paid revenue yet. Create and mark your first invoice as Paid to see insights.'}
                      </p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-lg">
                      <p className="text-sm font-medium">Expense Watch</p>
                      <p className="text-xs mt-1">
                        {totalExpenses > 0
                          ? `Total expenses stand at ${formatCurrency(totalExpenses)}. Monitor your top categories in the dashboard.`
                          : 'No expenses recorded yet. Add entries in the Expenses section.'}
                      </p>
                    </div>
                    <Button 
                      variant="secondary" 
                      className="w-full bg-white text-primary hover:bg-slate-100 gap-2"
                      disabled={loading || aiLoading}
                      onClick={async () => {
                        setAiLoading(true);
                        try {
                          const payload = {
                            total_revenue: totalRevenue,
                            total_expenses: totalExpenses,
                            gross_profit: grossProfit,
                            margin: margin
                          };
                          const res = await api.post('/api/v1/ai/insights', payload);
                          if (res.data?.data) {
                            setAiResult(res.data.data);
                            setShowAiModal(true);
                            
                            // Save to official notifications with full data
                            db.notifications.insert({
                              title: 'New AI Financial Insight',
                              message: res.data.data.summary || 'AI has analyzed your financial data and provided new recommendations.',
                              type: 'ai_insight',
                              metadata: res.data.data, // Full AI analysis
                              date: new Date().toISOString(),
                              isRead: false
                            });
                          } else {
                            info('AI Insight', 'Insights generated successfully.');
                          }
                        } catch (err: any) {
                          console.error('AI Insight Error:', err);
                          const msg = err.response?.data?.message || err.message || 'Failed to generate insights.';
                          error('AI Error', msg);
                        } finally {
                          setAiLoading(false);
                        }
                      }}
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        'Ask AI for More Insights'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>

      <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-primary/10 rounded-full text-primary">
                <TrendingUp size={20} />
              </div>
              <Badge variant="secondary">AI Financial Analyst</Badge>
            </div>
            <DialogTitle className="text-2xl">Financial Insights & Recommendations</DialogTitle>
            <DialogDescription>
              AI analysis based on your current year revenue and expenses.
            </DialogDescription>
          </DialogHeader>

          {aiResult && (
            <div className="space-y-6 py-4">
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border">
                <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-2">Executive Summary</h4>
                <p className="text-lg leading-relaxed">{aiResult.summary}</p>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500">Actionable Insights</h4>
                <div className="grid gap-3">
                  {aiResult.insights?.map((insight: any, i: number) => (
                    <div key={i} className="flex gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border shadow-sm">
                      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                        insight.priority === 'high' ? 'bg-rose-500' : 
                        insight.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                      }`} />
                      <div>
                        <p className="font-semibold text-sm">{insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {aiResult.vat_reminder && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                  <h4 className="font-bold text-sm text-amber-800 dark:text-amber-400 mb-1">VAT Compliance Notice</h4>
                  <p className="text-sm">{aiResult.vat_reminder}</p>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500">Recommended Next Actions</h4>
                <ul className="grid gap-2">
                  {aiResult.next_actions?.map((action: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-slate-900 p-2 rounded-md">
                      <div className="h-5 w-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</div>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
              
              <Button className="w-full" onClick={() => setShowAiModal(false)}>
                I Understand, Close Report
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
