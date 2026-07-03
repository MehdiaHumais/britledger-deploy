'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, MoreHorizontal, Mail, Phone, ExternalLink, Edit2, Trash2, Loader2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatCurrency, cn } from '@/lib/utils'
import db from '@/lib/local-db'

interface Client {
  id: string; name: string; email: string; phone: string
  balance: number; status: 'Active' | 'Inactive'; invoices: number
}

export default function ClientsPage() {
  const router = useRouter()
  const [clientsData, setClientsData] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' })
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [deactivateClient, setDeactivateClient] = useState<Client | null>(null)
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)

  const load = () => {
    const clients = db.clients.getAll('created_at', false) as Client[]
    // Calculate live invoices and balance for each client
    const invoices = db.invoices.getAll()
    clients.forEach(c => {
      const clientInvs = invoices.filter(i => i.clientId === c.id)
      c.invoices = clientInvs.length
      c.balance = clientInvs.filter(i => i.status !== 'Paid' && i.status !== 'Draft').reduce((sum, i) => sum + Number(i.amount), 0)
    })
    setClientsData(clients)
  }
  
  useEffect(() => { load() }, [])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    db.clients.insert({ ...newClient, balance: 0, status: 'Active', invoices: 0 })
    setNewClient({ name: '', email: '', phone: '' })
    setIsAddOpen(false)
    load()
    setIsSaving(false)
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editClient) return
    setIsEditing(true)
    db.clients.update(editClient.id, { name: editClient.name, email: editClient.email, phone: editClient.phone })
    setIsEditOpen(false)
    load()
    setIsEditing(false)
  }

  const handleDeactivate = () => {
    if (!deactivateClient) return
    setIsDeactivating(true)
    const newStatus = deactivateClient.status === 'Active' ? 'Inactive' : 'Active'
    db.clients.update(deactivateClient.id, { status: newStatus })
    setIsDeactivateOpen(false)
    load()
    setIsDeactivating(false)
  }

  const openView = (c: Client) => { router.push(`/clients/detail?id=${c.id}`) }
  const openEdit = (c: Client) => { setEditClient({ ...c }); setIsEditOpen(true) }
  const openDeactivate = (c: Client) => { setDeactivateClient(c); setIsDeactivateOpen(true) }

  const filtered = clientsData.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
            <p className="text-muted-foreground">Manage your customer relationships. Data is saved in your browser.</p>
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2"><Plus size={18} /> Add Client</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>Enter the client's contact information below.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Name *</label>
                  <Input required placeholder="e.g. Acme Corp" value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address *</label>
                  <Input required type="email" placeholder="billing@client.com" value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input placeholder="+44 20 7946 0000" value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? <><Loader2 size={16} className="animate-spin mr-2" />Creating...</> : 'Create Client'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
            {editClient && (
              <form onSubmit={handleEdit} className="space-y-4 py-4">
                <div className="space-y-2"><label className="text-sm font-medium">Name</label>
                  <Input required value={editClient.name} onChange={(e) => setEditClient({ ...editClient, name: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Email</label>
                  <Input required type="email" value={editClient.email} onChange={(e) => setEditClient({ ...editClient, email: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Phone</label>
                  <Input value={editClient.phone} onChange={(e) => setEditClient({ ...editClient, phone: e.target.value })} /></div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isEditing}>
                    {isEditing ? <><Loader2 size={16} className="animate-spin mr-2" />Saving...</> : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Deactivate confirm */}
        <Dialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{deactivateClient?.status === 'Active' ? 'Deactivate' : 'Reactivate'} Client</DialogTitle>
              <DialogDescription>
                {deactivateClient?.status === 'Active'
                  ? `Mark "${deactivateClient?.name}" as Inactive?`
                  : `Mark "${deactivateClient?.name}" as Active again?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeactivateOpen(false)} disabled={isDeactivating}>Cancel</Button>
              <Button variant={deactivateClient?.status === 'Active' ? 'destructive' : 'default'} onClick={handleDeactivate} disabled={isDeactivating}>
                {isDeactivating
                  ? <><Loader2 size={16} className="animate-spin mr-2" />{deactivateClient?.status === 'Active' ? 'Deactivating...' : 'Reactivating...'}</>
                  : deactivateClient?.status === 'Active' ? 'Deactivate' : 'Reactivate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Table */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input placeholder="Search by name or email..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Name</TableHead>
                    <TableHead className="min-w-[150px] hidden md:table-cell">Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead className="hidden sm:table-cell">Invoices</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length > 0 ? filtered.map((client) => (
                    <TableRow key={client.id} className="group">
                      <TableCell>
                        <div className="font-medium cursor-pointer hover:underline text-primary" onClick={() => openView(client)}>{client.name}</div>
                        <div className="text-xs text-muted-foreground md:hidden">{client.email}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs truncate max-w-[150px]"><Mail size={12} className="text-muted-foreground" />{client.email}</div>
                          {client.phone && <div className="flex items-center gap-1.5 text-xs"><Phone size={12} className="text-muted-foreground" />{client.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={client.status === 'Active' ? 'default' : 'secondary'} className="h-5">{client.status}</Badge></TableCell>
                      <TableCell><span className={client.balance > 0 ? "font-semibold text-rose-600" : "text-emerald-600"}>{formatCurrency(client.balance)}</span></TableCell>
                      <TableCell className="hidden sm:table-cell">{client.invoices}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={18} /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Client Options</DropdownMenuLabel>
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openView(client)}><ExternalLink size={14} /> View Details</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEdit(client)}><Edit2 size={14} /> Edit Client</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className={cn("gap-2 cursor-pointer", client.status === 'Active' ? "text-rose-600" : "text-emerald-600")} onClick={() => openDeactivate(client)}>
                              <Trash2 size={14} /> {client.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No clients found. Click "Add Client" to get started.
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
