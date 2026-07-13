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
import { useToast } from '../../components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import db from '@/lib/local-db'

export default function QuotationsPage() {
  const { success } = useToast()
  const [quotations, setQuotations] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('list')

  const load = () => setQuotations(db.quotations.getAll('created_at', false))
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
      status: 'Sent',
      items: data.items,
      notes: data.notes
    }
    if (data.backendId) {
      payload.backendId = data.backendId
    }
    db.quotations.insert(payload)
    db.notifications.insert({
      title: 'Quotation Created & Sent',
      message: `Quotation ${data.documentNumber} has been sent to the client.`,
      date: new Date().toISOString(),
      isRead: false
    })
    load()
    setActiveTab('list')
    success('Quotation Saved', `${data.documentNumber} has been saved successfully.`)
  }

  const handleDeleteQuotation = (quo: any) => {
    db.quotations.delete(quo.id)
    load()
    success('Quotation Deleted', `${quo.number} has been deleted.`)
  }

  const convertToInvoice = (quo: any) => {
    db.invoices.insert({
      number: quo.number.replace('QUO', 'INV'),
      client: quo.client,
      clientId: quo.clientId,
      date: new Date().toISOString().split('T')[0],
      dueDate: quo.dueDate,
      amount: quo.amount,
      subtotal: quo.subtotal,
      tax: quo.tax,
      status: 'Sent',
      items: quo.items,
      notes: quo.notes || ''
    })
    db.quotations.update(quo.id, { status: 'Accepted' })
    db.notifications.insert({
      title: 'Quotation Accepted',
      message: `Quotation ${quo.number} was accepted and converted to Invoice.`,
      date: new Date().toISOString(),
      isRead: false
    })
    load()
    success('Converted to Invoice', `${quo.number.replace('QUO', 'INV')} has been created in your Invoices.`)
  }

  const statusVariant = (s: string) =>
    s === 'Accepted' ? 'default' : s === 'Expired' ? 'destructive' : 'outline'

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
          <p className="text-muted-foreground">Create and send professional quotes to your clients.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 flex overflow-x-auto no-scrollbar justify-start w-full">
            <TabsTrigger value="list" className="shrink-0">All Quotations ({quotations.length})</TabsTrigger>
            <TabsTrigger value="create" className="shrink-0">Create New</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <Card className="border-none shadow-md overflow-hidden w-full">
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto">
                  <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Quotation #</TableHead>
                          <TableHead className="min-w-[150px]">Client</TableHead>
                          <TableHead className="min-w-[120px] hidden sm:table-cell">Date</TableHead>
                          <TableHead className="min-w-[120px] hidden md:table-cell">Due Date</TableHead>
                          <TableHead className="min-w-[100px]">Amount</TableHead>
                          <TableHead className="min-w-[100px]">Status</TableHead>
                          <TableHead className="text-right min-w-[120px] md:min-w-[150px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quotations.length > 0 ? quotations.map((quo) => (
                          <TableRow key={quo.id}>
                            <TableCell>
                              <div className="font-medium">{quo.number}</div>
                              <div className="text-xs text-muted-foreground sm:hidden">{quo.client}</div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">{quo.client}</TableCell>
                            <TableCell className="hidden sm:table-cell">{formatDate(quo.date)}</TableCell>
                            <TableCell className="hidden md:table-cell text-red-600 dark:text-red-400 font-medium">{formatDate(quo.dueDate)}</TableCell>
                            <TableCell>{formatCurrency(quo.amount)}</TableCell>
                            <TableCell><Badge variant={statusVariant(quo.status) as any}>{quo.status}</Badge></TableCell>
                            <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal size={18} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  disabled={quo.status === 'Accepted'}
                                  onClick={() => convertToInvoice(quo)}
                                >
                                  {quo.status === 'Accepted' ? '✓ Converted' : 'Convert to Invoice'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-rose-600 gap-2 cursor-pointer" onClick={() => handleDeleteQuotation(quo)}>
                                  <Trash2 size={14} /> Delete Quotation
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            No quotations yet. Click "Create New" to get started.
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
            <DocumentBuilder
              type="quotation"
              initialNumber={`QUO-${String(quotations.length + 1).padStart(3, '0')}`}
              onSave={handleSave}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
