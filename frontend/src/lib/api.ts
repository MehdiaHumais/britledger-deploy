import axios from 'axios'
import { useAuthStore } from '@/store/auth-store'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

console.log('🌐 [API_DEBUG] Base URL:', API_URL)

// Add token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// API Modules
export const authApi = {
  login: (data: any) => api.post('/api/v1/auth/login', data),
  register: (data: any) => api.post('/api/v1/auth/register', data),
  me: () => api.get('/api/v1/auth/me'),
}

export const userApi = {
  getMe: () => api.get('/api/v1/users/me'),
  updateMe: (data: any) => api.patch('/api/v1/users/me', data),
}

export const clientApi = {
  list: (params?: any) => api.get('/api/v1/clients', { params }),
  get: (id: string) => api.get(`/api/v1/clients/${id}`),
  create: (data: any) => api.post('/api/v1/clients', data),
  update: (id: string, data: any) => api.put(`/api/v1/clients/${id}`, data),
}

export const invoiceApi = {
  list: (params?: any) => api.get('/api/v1/invoices', { params }),
  create: (data: any) => api.post('/api/v1/invoices', data),
  send: (id: string, data: any) => api.post(`/api/v1/invoices/${id}/send`, data),
}

export const quotationApi = {
  list: (params?: any) => api.get('/api/v1/quotations', { params }),
  create: (data: any) => api.post('/api/v1/quotations', data),
  send: (id: string, data: any) => api.post(`/api/v1/quotations/${id}/send`, data),
}

export const reportApi = {
  profitLoss: (params: any) => api.get('/api/v1/reports/profit-loss', { params }),
  revenue: (params: any) => api.get('/api/v1/reports/revenue', { params }),
  vatSummary: (params: any) => api.get('/api/v1/vat/summary', { params }),
}

export const paymentApi = {
  getSettings: () => api.get('/api/v1/payments/settings'),
  updateSettings: (data: any) => api.post('/api/v1/payments/settings', data),
  createSession: (data: any) => api.post('/api/v1/payments/create-session', data),
}
