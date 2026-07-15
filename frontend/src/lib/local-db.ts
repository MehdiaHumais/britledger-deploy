/**
 * BritLedger Local Store
 * ---------------------
 * A simple localStorage-backed data store that mimics the Supabase API shape.
 * This persists all data across page navigations and browser refreshes
 * with zero external dependencies.
 */

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

// ── Generic CRUD factory ────────────────────────────────────────────────────

function makeTable<T extends { id: string; created_at?: string }>(tableName: string) {
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
    }
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
