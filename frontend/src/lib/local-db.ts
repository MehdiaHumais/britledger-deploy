/**
 * BritLedger Local Store
 * ---------------------
 * A simple localStorage-backed data store that mimics the Supabase API shape.
 * This persists all data across page navigations and browser refreshes
 * with zero external dependencies.
 *
 * Enhanced with API sync methods for server-side persistence.
 */

import { clientApi, invoiceApi, quotationApi } from './api'

// ── API handler mapping ──────────────────────────────────────────────
// Expenses are intentionally kept local-only: the backend bookkeeping
// service is still a stub and would wipe local data on sync.
const TABLE_API: Record<string, {
  list?: Function; create?: Function; update?: Function; remove?: Function;
} | undefined> = {
  clients: clientApi,
  invoices: invoiceApi,
  quotations: quotationApi,
}

function getActiveUserId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('britledger-auth-storage')
    if (raw) {
      const parsed = JSON.parse(raw)
      const userId = parsed?.state?.user?.id
      if (userId) return userId
    }
  } catch (e) {
    console.error('[DB] Error parsing auth store:', e)
  }
  return null
}

function getStore<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const userId = getActiveUserId()

    // If no userId, return empty — never read unscoped data
    if (key !== 'users' && key !== 'device_id' && !userId) return []

    const storageKey = (key !== 'users' && key !== 'device_id' && userId)
      ? `britledger_${userId}_${key}`
      : `britledger_${key}`

    const raw = localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setStore<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return
  let storageKey = `britledger_${key}`
  const userId = getActiveUserId()

  if (key !== 'users' && key !== 'device_id' && userId) {
    storageKey = `britledger_${userId}_${key}`
  }

  localStorage.setItem(storageKey, JSON.stringify(data))
}

function genId(): string {
  // Use browser's built-in UUID generator if available, otherwise fallback to a reasonably unique string
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}

function toTitle(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function clientName(clientId: string): string {
  const client = getStore<any>('clients').find((c) => c.id === clientId)
  return client?.name || ''
}

// ── Field mapping: frontend payload <-> backend schema ──────────────
const FIELD_MAPS: Record<string, { toApi: (d: any) => any; toLocal: (d: any) => any }> = {
  clients: {
    toApi: (d) => {
      const out: any = {}
      if (d.name !== undefined) out.name = d.name
      if (d.email !== undefined) out.email = d.email
      if (d.phone !== undefined) out.phone = d.phone
      if (d.address !== undefined) out.address = d.address
      if (d.company_name !== undefined) out.company_name = d.company_name
      if (d.vat_number !== undefined) out.vat_number = d.vat_number
      if (d.status !== undefined) out.is_active = d.status === 'Active'
      return out
    },
    toLocal: (d) => ({
      id: d.id,
      name: d.name,
      email: d.email || '',
      phone: d.phone || '',
      address: d.address || '',
      company_name: d.company_name || '',
      vat_number: d.vat_number || '',
      status: d.is_active === false ? 'Inactive' : 'Active',
      balance: 0,
      invoices: 0,
    }),
  },
  invoices: {
    toApi: (d) => {
      const out: any = {}
      if (d.clientId !== undefined) out.client_id = d.clientId
      if (d.number !== undefined) out.invoice_number = d.number
      if (d.date !== undefined) out.issue_date = d.date || null
      if (d.dueDate !== undefined) out.due_date = d.dueDate || null
      if (d.amount !== undefined) out.total_amount = Number(d.amount) || 0
      if (d.subtotal !== undefined) out.subtotal = Number(d.subtotal) || 0
      if (d.tax !== undefined) out.tax = Number(d.tax) || 0
      if (d.advancePayment !== undefined) out.advance_payment = Number(d.advancePayment) || 0
      if (d.currency !== undefined) out.currency = d.currency
      if (d.items !== undefined) out.items = d.items || []
      if (d.notes !== undefined) out.notes = d.notes || null
      if (d.status !== undefined) out.status = String(d.status).toUpperCase()
      return out
    },
    toLocal: (d) => ({
      id: d.id,
      number: d.invoice_number,
      clientId: d.client_id,
      client: clientName(d.client_id),
      date: d.issue_date,
      dueDate: d.due_date,
      amount: d.total_amount,
      subtotal: d.subtotal_amount,
      tax: d.tax_amount,
      advancePayment: d.advance_payment || 0,
      currency: d.currency || 'GBP',
      items: d.items || [],
      notes: d.notes,
      status: toTitle(d.status),
    }),
  },
  quotations: {
    toApi: (d) => {
      const out: any = {}
      if (d.clientId !== undefined) out.client_id = d.clientId
      if (d.number !== undefined) out.quotation_number = d.number
      if (d.date !== undefined) out.issue_date = d.date || null
      if (d.dueDate !== undefined) out.expiry_date = d.dueDate || null
      if (d.amount !== undefined) out.total_amount = Number(d.amount) || 0
      if (d.subtotal !== undefined) out.subtotal = Number(d.subtotal) || 0
      if (d.tax !== undefined) out.tax = Number(d.tax) || 0
      if (d.currency !== undefined) out.currency = d.currency
      if (d.items !== undefined) out.items = d.items || []
      if (d.notes !== undefined) out.notes = d.notes || null
      if (d.status !== undefined) out.status = String(d.status).toUpperCase()
      return out
    },
    toLocal: (d) => ({
      id: d.id,
      number: d.quotation_number,
      clientId: d.client_id,
      client: clientName(d.client_id),
      date: d.issue_date,
      dueDate: d.expiry_date,
      amount: d.total_amount,
      subtotal: d.subtotal_amount,
      tax: d.tax_amount,
      currency: d.currency || 'GBP',
      items: d.items || [],
      notes: d.notes,
      status: toTitle(d.status),
    }),
  },
}

// ── Generic CRUD factory ────────────────────────────────────────────────────

function makeTable<T extends { id: string; created_at?: string }>(tableName: string) {
  const api = TABLE_API[tableName]
  const map = FIELD_MAPS[tableName]

  const extractData = (res: any): any[] => {
    if (!res?.data) return []
    const body = res.data
    if (Array.isArray(body)) return body
    if (body.data && Array.isArray(body.data)) return body.data
    if (body.data && typeof body.data === 'object') return [body.data]
    return []
  }

  const extractRecord = (res: any): any | null => {
    if (!res?.data) return null
    const body = res.data
    if (body.data && typeof body.data === 'object') return body.data
    return body
  }

  return {
    getAll(orderBy?: keyof T, ascending = false): T[] {
      const data = getStore<T>(tableName)
      if (!orderBy) return data
      return [...data].sort((a, b) => {
        const av = a[orderBy] as any
        const bv = b[orderBy] as any
        return ascending ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
    },

    insert(record: Omit<T, 'id' | 'created_at'>): T {
      const data = getStore<T>(tableName)
      const newRecord = {
        ...record,
        id: genId(),
        created_at: new Date().toISOString(),
      } as T
      setStore(tableName, [newRecord, ...data])
      return newRecord
    },

    update(id: string, changes: Partial<T>): T | null {
      const data = getStore<T>(tableName)
      let updated: T | null = null
      const newData = data.map(item => {
        if (item.id === id) {
          updated = { ...item, ...changes }
          return updated
        }
        return item
      })
      setStore(tableName, newData)
      return updated
    },

    delete(id: string): void {
      const data = getStore<T>(tableName)
      setStore(tableName, data.filter(item => item.id !== id))
    },

    count(): number {
      return getStore<T>(tableName).length
    },

    findOne(predicate: (item: T) => boolean): T | null {
      return getStore<T>(tableName).find(predicate) || null
    },

    // ── API-backed sync methods ───────────────────────────────────────────

    async syncFromApi(): Promise<T[]> {
      if (!api?.list) return this.getAll()
      try {
        const res = await api.list()
        const records = extractData(res)
        if (records.length > 0) {
          const local = map ? records.map(map.toLocal) : records
          setStore(tableName, local)
        }
      } catch (e: any) {
        if (e?.response?.status !== 401) {
          console.error(`[DB] Failed to sync ${tableName} from API:`, e)
        }
      }
      return this.getAll()
    },

    async createRecord(record: Omit<T, 'id' | 'created_at'>): Promise<T> {
      if (api?.create) {
        try {
          const payload = map ? map.toApi(record) : record
          const res = await api.create(payload)
          const serverRecord = extractRecord(res)
          if (serverRecord && serverRecord.id) {
            const local = map ? map.toLocal(serverRecord) : serverRecord
            const data = getStore<T>(tableName)
            setStore(tableName, [local, ...data])
            return local
          }
        } catch (e: any) {
          if (e?.response?.status !== 401) {
            console.error(`[DB] API create failed for ${tableName}, falling back to local:`, e)
          }
        }
      }
      return this.insert(record)
    },

    async modifyRecord(id: string, changes: Partial<T>): Promise<T | null> {
      if (api?.update) {
        try {
          const payload = map ? map.toApi(changes) : changes
          const res = await api.update(id, payload)
          const serverRecord = extractRecord(res)
          if (serverRecord) {
            const local = map ? map.toLocal(serverRecord) : serverRecord
            const data = getStore<T>(tableName)
            setStore(tableName, data.map(item => item.id === id ? { ...item, ...local } : item) as T[])
            return local
          }
        } catch (e: any) {
          if (e?.response?.status !== 401) {
            console.error(`[DB] API update failed for ${tableName}, falling back to local:`, e)
          }
        }
      }
      return this.update(id, changes)
    },

    async removeRecord(id: string): Promise<void> {
      if (api?.remove) {
        try {
          await api.remove(id)
        } catch (e: any) {
          const status = e?.response?.status
          if (status !== 401 && status !== 404) {
            console.error(`[DB] API delete failed for ${tableName}:`, e)
          }
        }
      }
      this.delete(id)
    },
  }
}

// ── Exported Tables ─────────────────────────────────────────────────────────

export const db = {
  users:      makeTable<any>('users'),
  clients:    makeTable<any>('clients'),
  invoices:   makeTable<any>('invoices'),
  quotations: makeTable<any>('quotations'),
  expenses:   makeTable<any>('expenses'),
  vat_returns: makeTable<any>('vat_returns'),
  notifications: makeTable<any>('notifications'),
}

export default db
