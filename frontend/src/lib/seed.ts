/**
 * Seed the super admin user into local-db so login works on this device.
 * Also calls the backend API to ensure the user exists in PostgreSQL.
 */
import db from './local-db'
import api from './api'

const ADMIN_EMAIL = 'britsyncuk@gmail.com'
const ADMIN_PASSWORD = 'superadmin123'
const ADMIN_NAME = 'Super Admin'

export async function seedSuperAdmin(): Promise<void> {
  if (typeof window === 'undefined') return

  const existing = db.users.findOne((u: any) => u.email === ADMIN_EMAIL)
  if (existing) return

  const newUser = db.users.insert({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    company_name: 'BritLedger',
    role: 'SUPERADMIN',
    is_fingerprint: false,
  })

  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ledger.britsyncai.com'
    await fetch(`${API_URL}/api/v1/admin/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        full_name: ADMIN_NAME,
        role: 'SUPERADMIN',
      }),
    })
  } catch {
    // Backend might be unreachable during dev — that's ok
  }
}
