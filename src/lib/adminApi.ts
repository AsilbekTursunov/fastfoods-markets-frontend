import type { PlatformSession, PlatformUser, PlatformRole, ServiceAdmin, ServiceAdminRole, ServiceSummary } from '@/types'
import { ApiError, isMock } from './api'
import { mockAdminApi } from './adminMock'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') + '/api'
const KEY = 'ffm:admin'

export function getAdminSession(): PlatformSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PlatformSession) : null
  } catch {
    return null
  }
}

export function setAdminSession(s: PlatformSession | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s))
  else localStorage.removeItem(KEY)
}

async function http<T>(path: string, opts: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string>) }
  if (opts.auth !== false) {
    const s = getAdminSession()
    if (s) headers.Authorization = `Bearer ${s.token}`
  }
  let res: Response
  try {
    res = await fetch(BASE + path, { ...opts, headers })
  } catch {
    throw new ApiError(0, 'Server bilan aloqa yo‘q')
  }
  if (!res.ok) {
    // expired platform token → back to the login gate
    if (res.status === 401 && opts.auth !== false && getAdminSession()) {
      setAdminSession(null)
      location.reload()
    }
    let msg = res.statusText || `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j.message || j.detail || j.error || msg
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg)
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>)
}

export interface CreateServiceAdmin {
  login: string
  password: string
  name: string
  role?: ServiceAdminRole
}
export interface UpdateServiceAdmin {
  name?: string
  role?: ServiceAdminRole
  password?: string
}
export interface CreatePlatformUser {
  login: string
  password: string
  name: string
  role?: PlatformRole
}
export interface UpdatePlatformUser {
  name?: string
  role?: PlatformRole
  active?: boolean
  password?: string
}

/** Everything the developer panel needs. Both the real client and the mock implement it. */
export interface AdminApi {
  login(login: string, password: string): Promise<PlatformSession>
  me(): Promise<PlatformUser>
  changeMyPassword(password: string): Promise<PlatformUser>

  services(): Promise<ServiceSummary[]>
  serviceAdmins(slug: string): Promise<ServiceAdmin[]>
  allServiceAdmins(): Promise<ServiceAdmin[]>
  createServiceAdmin(slug: string, body: CreateServiceAdmin): Promise<ServiceAdmin>
  updateServiceAdmin(slug: string, id: number, body: UpdateServiceAdmin): Promise<ServiceAdmin>
  deleteServiceAdmin(slug: string, id: number): Promise<void>

  users(): Promise<PlatformUser[]>
  createUser(body: CreatePlatformUser): Promise<PlatformUser>
  updateUser(id: number, body: UpdatePlatformUser): Promise<PlatformUser>
  deleteUser(id: number): Promise<void>
}

const realAdminApi: AdminApi = {
  login: (login, password) => http<PlatformSession>('/admin/login', { method: 'POST', body: JSON.stringify({ login, password }), auth: false }),
  me: () => http<PlatformUser>('/admin/me'),
  changeMyPassword: (password) => http<PlatformUser>('/admin/me/password', { method: 'PATCH', body: JSON.stringify({ password }) }),

  services: () => http<ServiceSummary[]>('/admin/services'),
  serviceAdmins: (slug) => http<ServiceAdmin[]>(`/admin/services/${slug}/admins`),
  allServiceAdmins: () => http<ServiceAdmin[]>('/admin/service-admins'),
  createServiceAdmin: (slug, body) => http<ServiceAdmin>(`/admin/services/${slug}/admins`, { method: 'POST', body: JSON.stringify(body) }),
  updateServiceAdmin: (slug, id, body) => http<ServiceAdmin>(`/admin/services/${slug}/admins/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteServiceAdmin: (slug, id) => http<void>(`/admin/services/${slug}/admins/${id}`, { method: 'DELETE' }),

  users: () => http<PlatformUser[]>('/admin/users'),
  createUser: (body) => http<PlatformUser>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id, body) => http<PlatformUser>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUser: (id) => http<void>(`/admin/users/${id}`, { method: 'DELETE' }),
}

export const adminApi: AdminApi = isMock ? mockAdminApi : realAdminApi

/** Readable password suggestion for a new account. */
export function suggestPassword(length = 10): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
