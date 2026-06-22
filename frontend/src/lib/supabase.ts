/**
 * BritLedger Supabase Client
 * --------------------------
 * Uses Supabase's built-in REST API (PostgREST) with native fetch.
 * No npm package required — just your URL and anon key in .env.local
 *
 * Setup:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
}

async function query(table: string, options: {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  filters?: Record<string, string>
  order?: { column: string; ascending?: boolean }
  body?: object
  single?: boolean
} = {}) {
  const { method = 'GET', filters = {}, order, body, single } = options

  const params = new URLSearchParams()

  if (method === 'GET') params.set('select', '*')

  // Apply filters: e.g. { id: 'eq.abc123' }
  for (const [col, val] of Object.entries(filters)) {
    params.set(col, val)
  }

  if (order) {
    params.set('order', `${order.column}.${order.ascending ? 'asc' : 'desc'}`)
  }

  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`

  const res = await fetch(url, {
    method,
    headers: single
      ? { ...headers, Accept: 'application/vnd.pgrst.object+json' }
      : headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error(`[Supabase] ${method} /${table} failed:`, err)
    return { data: null, error: err }
  }

  if (method === 'DELETE' || res.status === 204) {
    return { data: null, error: null }
  }

  const data = await res.json()
  return { data, error: null }
}

// ── Public API (mirrors @supabase/supabase-js shape) ──────────────────────

export const supabase = {
  from(table: string) {
    return {
      /** Fetch all rows, optional ordering */
      select(columns = '*') {
        return {
          order(column: string, opts?: { ascending?: boolean }) {
            return query(table, { order: { column, ascending: opts?.ascending ?? false } })
          },
          eq(col: string, val: string) {
            return query(table, { filters: { [col]: `eq.${val}` } })
          },
          // Default: fetch all without order
          then(resolve: (v: any) => any) {
            return query(table).then(resolve)
          }
        }
      },

      /** Insert one or more rows */
      insert(data: object | object[]) {
        const body = Array.isArray(data) ? data : [data]
        return {
          select() {
            return {
              single() {
                return query(table, { method: 'POST', body: body[0], single: true })
              },
              then(resolve: (v: any) => any) {
                return query(table, { method: 'POST', body: body[0] }).then(resolve)
              }
            }
          },
          then(resolve: (v: any) => any) {
            return query(table, { method: 'POST', body: body[0] }).then(resolve)
          }
        }
      },

      /** Update rows matching a filter */
      update(changes: object) {
        return {
          eq(col: string, val: string) {
            return query(table, {
              method: 'PATCH',
              filters: { [col]: `eq.${val}` },
              body: changes,
            })
          }
        }
      },

      /** Delete rows matching a filter */
      delete() {
        return {
          eq(col: string, val: string) {
            return query(table, {
              method: 'DELETE',
              filters: { [col]: `eq.${val}` },
            })
          }
        }
      },
    }
  }
}

export default supabase
