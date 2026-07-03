'use client'

import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign, Clock, CreditCard, AlertCircle,
  ArrowUpRight, ArrowDownRight, Receipt, FileText
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'
import db from '@/lib/local-db'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function buildMonthlyData(invoices: any[], expenses: any[]) {
  return MONTH_LABELS.map((name, idx) => {
    const revenue = invoices
      .filter(i => new Date(i.date).getMonth() === idx && i.status === 'Paid')
      .reduce((s, i) => s + Number(i.amount), 0)
    const exp = expenses
      .filter(e => new Date(e.date).getMonth() === idx && e.type === 'expense')
      .reduce((s, e) => s + Number(e.amount), 0)
    return { name, revenue, expenses: exp }
  })
}

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setInvoices(db.invoices.getAll('created_at', false))
    setExpenses(db.expenses.getAll('date', false))
    setClients(db.clients.getAll())
    setLoading(false)
  }, [])

  // Computed stats
  const totalRevenue = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.amount), 0)
  const unpaidInvoices = invoices.filter(i => i.status !== 'Paid' && i.status !== 'Draft').reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
  const vatOwed = totalRevenue * 0.20 // simplified 20% estimate

  const revenueData = buildMonthlyData(invoices, expenses)

  const expenseCategoryMap: Record<string, number> = {}
  expenses.filter(e => e.type === 'expense').forEach(e => {
    expenseCategoryMap[e.category] = (expenseCategoryMap[e.category] || 0) + Number(e.amount)
  })
  const COLORS = ['#3b82f6','#60a5fa','#93c5fd','#f59e0b','#ef4444','#10b981','#8b5cf6']
  const expenseCategories = Object.entries(expenseCategoryMap).map(([name, value], i) => ({
    name, value, color: COLORS[i % COLORS.length]
  }))
  if (expenseCategories.length === 0) expenseCategories.push({ name: 'No data', value: 1, color: '#e2e8f0' })

  const invoiceStatusData = [
    { name: 'Paid', value: invoices.filter(i => i.status === 'Paid').length, color: '#10b981' },
    { name: 'Sent', value: invoices.filter(i => i.status === 'Sent').length, color: '#3b82f6' },
    { name: 'Overdue', value: invoices.filter(i => i.status === 'Overdue').length, color: '#ef4444' },
    { name: 'Draft', value: invoices.filter(i => i.status === 'Draft').length, color: '#6b7280' },
  ]

  // Recent activity = last 5 items across invoices + expenses
  const recentActivity = [
    ...invoices.slice(0, 3).map(i => ({ id: i.id, type: 'invoice', label: i.client, amount: i.amount, status: i.status, date: i.date })),
    ...expenses.slice(0, 2).map(e => ({ id: e.id, type: 'expense', label: e.description, amount: e.amount, status: e.type, date: e.date })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {loading ? 'Loading your business overview...' : `Overview across ${clients.length} clients and ${invoices.length} invoices.`}
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)}
            change={invoices.length > 0 ? `${invoices.filter(i=>i.status==='Paid').length} paid invoices` : 'No paid invoices yet'}
            trend={totalRevenue > 0 ? 'up' : 'none'}
            icon={<DollarSign className="text-primary" size={20} />} />
          <StatCard title="Unpaid Invoices" value={formatCurrency(unpaidInvoices)}
            change={`${invoices.filter(i=>i.status!=='Paid'&&i.status!=='Draft').length} outstanding`}
            trend={unpaidInvoices > 0 ? 'down' : 'none'}
            icon={<Clock className="text-amber-500" size={20} />} />
          <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)}
            change={`${expenses.filter(e=>e.type==='expense').length} expense entries`}
            trend={totalExpenses > 0 ? 'up' : 'none'}
            icon={<CreditCard className="text-rose-500" size={20} />} />
          <StatCard title="VAT Estimate" value={formatCurrency(vatOwed)}
            change="Based on 20% of paid revenue"
            trend="none"
            icon={<AlertCircle className="text-blue-500" size={20} />} />
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-7">
          <Card className="col-span-full md:col-span-4">
            <CardHeader>
              <CardTitle>Revenue vs Expenses</CardTitle>
              <CardDescription>Monthly performance (paid invoices)</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] sm:h-[300px] w-full overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `£${v}`} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-full md:col-span-3">
            <CardHeader>
              <CardTitle>Expense Categories</CardTitle>
              <CardDescription>Top spending categories</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] sm:h-[300px] flex flex-col sm:flex-row gap-4 items-center justify-center sm:justify-start">
              <div className="h-full w-full sm:w-[60%] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseCategories} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                      {expenseCategories.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1 w-full overflow-hidden">
                {expenseCategories.slice(0, 5).map((cat) => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-xs font-medium truncate">{cat.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="col-span-full md:col-span-1">
            <CardHeader>
              <CardTitle>Invoice Status</CardTitle>
              <CardDescription>Overall breakdown of invoices</CardDescription>
            </CardHeader>
            <CardContent className="h-[200px] sm:h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invoiceStatusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {invoiceStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-full md:col-span-1">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest transactions and actions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                          item.type === 'invoice' ? "bg-blue-100 text-blue-600" : "bg-rose-100 text-rose-600"
                        )}>
                          {item.type === 'invoice' ? <Receipt size={16} /> : <CreditCard size={16} />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(item.amount)}</p>
                        <Badge variant="outline" className="text-[10px] h-5">{item.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <FileText className="text-slate-400" size={24} />
                  </div>
                  <p className="text-sm font-medium">No recent activity</p>
                  <p className="text-xs text-muted-foreground">Transactions will appear here once you create them.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

function StatCard({ title, value, change, trend, icon }: {
  title: string; value: string; change: string; trend: 'up' | 'down' | 'none'; icon: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden border-none shadow-md shadow-slate-200/50 w-full min-w-0">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h2 className="text-2xl font-bold mt-1">{value}</h2>
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center dark:bg-slate-900">
            {icon}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1">
          {trend === 'up' && <ArrowUpRight className="text-emerald-500" size={14} />}
          {trend === 'down' && <ArrowDownRight className="text-rose-500" size={14} />}
          <span className={cn("text-xs font-medium",
            trend === 'up' ? "text-emerald-500" : trend === 'down' ? "text-rose-500" : "text-muted-foreground"
          )}>{change}</span>
        </div>
      </CardContent>
    </Card>
  )
}
