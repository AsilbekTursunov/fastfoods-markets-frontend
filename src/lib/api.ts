import type {
  Category,
  CategoryInput,
  CategoryTemplate,
  CreateOrderInput,
  DashboardSession,
  DashboardStats,
  Market,
  MarketSettings,
  PromoSchedule,
  PromoScheduleInput,
  Order,
  OrderStatus,
  Product,
  PromoInput,
  PromoResult,
  TelegramStatus,
} from '@/types'
import { mockApi } from './mock'

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') === 'true'
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') + '/api'

const SESSION_KEY = (slug: string) => `ffm:dash:${slug}`

export function getSession(slug: string): DashboardSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY(slug))
    return raw ? (JSON.parse(raw) as DashboardSession) : null
  } catch {
    return null
  }
}
export function setSession(slug: string, s: DashboardSession | null) {
  if (s) localStorage.setItem(SESSION_KEY(slug), JSON.stringify(s))
  else localStorage.removeItem(SESSION_KEY(slug))
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function readError(res: Response): Promise<ApiError> {
  let msg = res.statusText || `HTTP ${res.status}`
  try {
    const j = await res.json()
    msg = j.message || j.detail || j.error || msg
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, msg)
}

/** Expired / invalid dashboard token → drop session, DashboardLayout shows login. */
function handleUnauthorized(slug: string | undefined, res: Response) {
  if (res.status === 401 && slug && getSession(slug)) {
    setSession(slug, null)
    location.reload()
  }
}

async function http<T>(path: string, opts: RequestInit & { slug?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string>) }
  if (opts.slug) {
    const s = getSession(opts.slug)
    if (s) headers.Authorization = `Bearer ${s.token}`
  }
  let res: Response
  try {
    res = await fetch(BASE + path, { ...opts, headers })
  } catch {
    throw new ApiError(0, 'Server bilan aloqa yo‘q. Internetni tekshiring.')
  }
  if (!res.ok) {
    handleUnauthorized(opts.slug, res)
    throw await readError(res)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const q = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  Object.entries(o).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)))
  const s = p.toString()
  return s ? `?${s}` : ''
}

/**
 * Every backend call the app uses. Both the real client and the mock implement
 * this, so adding a method here forces a mock counterpart (no runtime surprises).
 */
export interface Api {
  // public
  listMarkets(): Promise<Market[]>
  getMarket(slug: string): Promise<Market>
  getProducts(slug: string): Promise<Product[]>
  createOrder(slug: string, input: CreateOrderInput): Promise<Order>
  getMyOrders(slug: string, tgId?: number, phone?: string): Promise<Order[]>
  getOrder(slug: string, id: string): Promise<Order>
  // dashboard
  login(slug: string, login: string, password: string): Promise<DashboardSession>
  me(slug: string): Promise<Pick<DashboardSession, 'marketSlug' | 'role' | 'name'>>
  dashboardOrders(slug: string, status?: OrderStatus | 'active'): Promise<Order[]>
  updateOrderStatus(slug: string, id: string, status: OrderStatus): Promise<Order>
  dashboardProducts(slug: string): Promise<Product[]>
  upsertProduct(slug: string, product: Product): Promise<Product>
  deleteProduct(slug: string, id: string): Promise<void>
  categories(slug: string): Promise<Category[]>
  categoryTemplates(slug: string): Promise<CategoryTemplate[]>
  createCategory(slug: string, c: CategoryInput): Promise<Category>
  updateCategory(slug: string, id: string, c: CategoryInput): Promise<Category>
  deleteCategory(slug: string, id: string): Promise<void>
  uploadImage(slug: string, file: File): Promise<string>
  getSettings(slug: string): Promise<MarketSettings>
  updateSettings(slug: string, s: MarketSettings): Promise<MarketSettings>
  telegramStatus(slug: string): Promise<TelegramStatus>
  telegramTest(slug: string): Promise<{ ok: boolean; chatId?: number | string; chatTitle?: string | null }>
  /** send the "open mini app" promo message with an inline web-app button */
  sendPromo(slug: string, input: PromoInput): Promise<PromoResult>
  /** the single promo image: saved immediately, deleting removes the file from storage too */
  uploadPromoImage(slug: string, file: File): Promise<string>
  deletePromoImage(slug: string): Promise<void>
  // "Message interval" announcements
  listPromos(slug: string): Promise<PromoSchedule[]>
  createPromo(slug: string, input: PromoScheduleInput): Promise<PromoSchedule>
  updatePromo(slug: string, id: number, input: PromoScheduleInput): Promise<PromoSchedule>
  deletePromo(slug: string, id: number): Promise<void>
  uploadPromoScheduleImage(slug: string, id: number, file: File): Promise<PromoSchedule>
  deletePromoScheduleImage(slug: string, id: number): Promise<PromoSchedule>
  sendPromoNow(slug: string, id: number): Promise<PromoSchedule>
  stats(slug: string): Promise<DashboardStats>
}

/** multipart POST: do NOT set Content-Type, the browser adds the boundary */
async function uploadFile<T>(slug: string, path: string, file: File): Promise<T> {
  const s = getSession(slug)
  const fd = new FormData()
  fd.append('file', file)
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { method: 'POST', headers: s ? { Authorization: `Bearer ${s.token}` } : {}, body: fd })
  } catch {
    throw new ApiError(0, 'Server bilan aloqa yo‘q')
  }
  if (!res.ok) {
    handleUnauthorized(slug, res)
    throw await readError(res)
  }
  return (await res.json()) as T
}

const realApi: Api = {
  listMarkets: () => http<Market[]>(`/markets`),
  getMarket: (slug) => http<Market>(`/markets/${slug}`),
  getProducts: (slug) => http<Product[]>(`/markets/${slug}/products`),
  createOrder: (slug, input) => http<Order>(`/markets/${slug}/orders`, { method: 'POST', body: JSON.stringify(input) }),
  getMyOrders: (slug, tgId, phone) => http<Order[]>(`/markets/${slug}/orders${q({ tg_id: tgId, phone })}`),
  getOrder: (slug, id) => http<Order>(`/markets/${slug}/orders/${id}`),

  login: (slug, login, password) =>
    http<DashboardSession>(`/dashboard/${slug}/login`, { method: 'POST', body: JSON.stringify({ login, password }) }),
  me: (slug) => http(`/dashboard/${slug}/me`, { slug }),
  dashboardOrders: (slug, status) => http<Order[]>(`/dashboard/${slug}/orders${q({ status })}`, { slug }),
  updateOrderStatus: (slug, id, status) =>
    http<Order>(`/dashboard/${slug}/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }), slug }),
  dashboardProducts: (slug) => http<Product[]>(`/dashboard/${slug}/products`, { slug }),
  upsertProduct: (slug, product) =>
    product.id
      ? http<Product>(`/dashboard/${slug}/products/${product.id}`, { method: 'PUT', body: JSON.stringify(product), slug })
      : http<Product>(`/dashboard/${slug}/products`, { method: 'POST', body: JSON.stringify(product), slug }),
  deleteProduct: (slug, id) => http<void>(`/dashboard/${slug}/products/${id}`, { method: 'DELETE', slug }),

  categories: (slug) => http<Category[]>(`/dashboard/${slug}/categories`, { slug }),
  categoryTemplates: (slug) => http<CategoryTemplate[]>(`/dashboard/${slug}/categories/templates`, { slug }),
  createCategory: (slug, c) => http<Category>(`/dashboard/${slug}/categories`, { method: 'POST', body: JSON.stringify(c), slug }),
  updateCategory: (slug, id, c) => http<Category>(`/dashboard/${slug}/categories/${id}`, { method: 'PUT', body: JSON.stringify(c), slug }),
  deleteCategory: (slug, id) => http<void>(`/dashboard/${slug}/categories/${id}`, { method: 'DELETE', slug }),

  uploadImage: async (slug, file) => ((await uploadFile<{ url: string }>(slug, `/dashboard/${slug}/upload`, file)).url),

  getSettings: (slug) => http<MarketSettings>(`/dashboard/${slug}/settings`, { slug }),
  updateSettings: (slug, s) => http<MarketSettings>(`/dashboard/${slug}/settings`, { method: 'PUT', body: JSON.stringify(s), slug }),
  telegramStatus: (slug) => http<TelegramStatus>(`/dashboard/${slug}/telegram`, { slug }),
  telegramTest: (slug) => http(`/dashboard/${slug}/telegram/test`, { method: 'POST', slug }),
  sendPromo: (slug, input) => http<PromoResult>(`/dashboard/${slug}/telegram/promo`, { method: 'POST', body: JSON.stringify(input), slug }),
  uploadPromoImage: async (slug, file) => (await uploadFile<{ url: string }>(slug, `/dashboard/${slug}/telegram/promo/image`, file)).url,
  deletePromoImage: (slug) => http<void>(`/dashboard/${slug}/telegram/promo/image`, { method: 'DELETE', slug }),
  listPromos: (slug) => http<PromoSchedule[]>(`/dashboard/${slug}/promos`, { slug }),
  createPromo: (slug, input) => http<PromoSchedule>(`/dashboard/${slug}/promos`, { method: 'POST', body: JSON.stringify(input), slug }),
  updatePromo: (slug, id, input) => http<PromoSchedule>(`/dashboard/${slug}/promos/${id}`, { method: 'PUT', body: JSON.stringify(input), slug }),
  deletePromo: (slug, id) => http<void>(`/dashboard/${slug}/promos/${id}`, { method: 'DELETE', slug }),
  uploadPromoScheduleImage: (slug, id, file) => uploadFile<PromoSchedule>(slug, `/dashboard/${slug}/promos/${id}/image`, file),
  deletePromoScheduleImage: (slug, id) => http<PromoSchedule>(`/dashboard/${slug}/promos/${id}/image`, { method: 'DELETE', slug }),
  sendPromoNow: (slug, id) => http<PromoSchedule>(`/dashboard/${slug}/promos/${id}/send`, { method: 'POST', slug }),
  stats: (slug) => http<DashboardStats>(`/dashboard/${slug}/stats`, { slug }),
}

export const api: Api = USE_MOCK ? mockApi : realApi
export const isMock = USE_MOCK
