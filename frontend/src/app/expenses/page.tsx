'use client'

import React, { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Filter, Download, ArrowUpCircle, ArrowDownCircle, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import db from '@/lib/local-db'

const CATEGORIES = ['Sales', 'Rent', 'Software', 'Salaries', 'Marketing', 'Utilities', 'Supplies', 'Travel', 'Other']

export default function ExpensesPage() {
  const { warning } = useToast()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newTx, setNewTx] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Other',
    type: 'expense',
    amount: ''
  })

  const fetchTransactions = () => {
    setLoading(true)
    setTransactions(db.expenses.getAll('date', false))
    setLoading(false)
  }

  useEffect(() => { fetchTransactions() }, [])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    db.expenses.insert({ ...newTx, amount: parseFloat(newTx.amount) })
    if (newTx.type === 'expense') {
      db.notifications.insert({
        title: 'Expense Recorded',
        message: `Expense of £${parseFloat(newTx.amount).toFixed(2)} for ${newTx.description} has been paid and recorded.`,
        date: new Date().toISOString(),
        isRead: false
      })
    }
    
    setTransactions(db.expenses.getAll('date', false))
    setNewTx({ date: new Date().toISOString().split('T')[0], description: '', category: 'Other', type: 'expense', amount: '' })
    setIsAddOpen(false)
    setSaving(false)
  }

  const filtered = transactions.filter(tx =>
    tx.description.toLowerCase().includes(search.toLowerCase()) ||
    tx.category.toLowerCase().includes(search.toLowerCase())
  )

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netProfit = totalIncome - totalExpenses

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      warning('No Data', 'There are no transactions to export yet.')
      return
    }
    const headers = ["Date,Description,Category,Type,Amount\n"]
    const rows = transactions.map(t => 
      `${t.date},"${t.description}",${t.category},${t.type},${t.amount}`
    )
    const csvContent = headers.concat(rows).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'expenses_export.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expenses & Bookkeeping</h1>
            <p className="text-muted-foreground">Track your business spending and income.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleExportCSV}><Download size={18} /> Export CSV</Button>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus size={18} /> Add Entry</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Transaction</DialogTitle>
                  <DialogDescription>Record an income or expense entry.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Type</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={newTx.type}
                        onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date</label>
                      <Input type="date" value={newTx.date}
                        onChange={(e) => setNewTx({ ...newTx, date: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input required placeholder="e.g. Office Rent" value={newTx.description}
                      onChange={(e) => setNewTx({ ...newTx, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={newTx.category}
                        onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Amount (£)</label>
                      <Input required type="number" min="0.01" step="0.01" placeholder="0.00"
                        value={newTx.amount}
                        onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? <><Loader2 size={16} className="animate-spin mr-2" />Saving...</> : 'Add Entry'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Total Income</CardDescription>
              <CardTitle className="text-2xl text-emerald-600">{formatCurrency(totalIncome)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Total Expenses</CardDescription>
              <CardTitle className="text-2xl text-rose-600">{formatCurrency(totalExpenses)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Net Profit</CardDescription>
              <CardTitle className={cn("text-2xl", netProfit >= 0 ? "text-primary" : "text-rose-600")}>
                {formatCurrency(netProfit)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card className="border-none shadow-md">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input placeholder="Search transactions..." className="pl-10"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Button variant="outline" size="icon"><Filter size={18} /></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">Date</TableHead>
                    <TableHead className="min-w-[150px]">Description</TableHead>
                    <TableHead className="min-w-[120px]">Category</TableHead>
                    <TableHead className="min-w-[100px]">Type</TableHead>
                    <TableHead className="text-right min-w-[120px]">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 size={18} className="animate-spin" /> Loading transactions...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filtered.length > 0 ? (
                    filtered.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{formatDate(tx.date)}</TableCell>
                        <TableCell className="font-medium">{tx.description}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">{tx.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {tx.type === 'income'
                              ? <ArrowUpCircle size={16} className="text-emerald-500" />
                              : <ArrowDownCircle size={16} className="text-rose-500" />}
                            <span className="capitalize">{tx.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className={cn("text-right font-semibold",
                          tx.type === 'income' ? "text-emerald-600" : "text-rose-600")}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No transactions recorded. Click "Add Entry" to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
