export type DeliveryType = 'delivery' | 'pickup'
export type PaymentType = 'cash' | 'card' | 'click' | 'payme'
export type OrderStatus = 'new' | 'accepted' | 'preparing' | 'delivering' | 'done' | 'cancelled'

export interface Category {
  id: string
  name: string
  sort: number
}



export interface ProductVariant {
  id: string
  name: string // "Kichik (17 sm)", "1.5 L"
  price: number
  description?: string
}

export interface Product {
  id: string
  categoryId: string
  name: string
  description?: string
  /** price for simple products; for products with variants = lowest variant price ("dan") */
  price: number
  variants?: ProductVariant[]
  image?: string
  available: boolean
  popular?: boolean
}

export interface Market {
  slug: string
  name: string
  tagline?: string
  logo?: string // emoji or image url
  brand?: string // hex color
  phone?: string
  phone2?: string
  address?: string
  currency: string
  deliveryFee: number
  minOrder: number
  freeDeliveryFrom?: number
  workingHours: { open: string; close: string } // "09:00" - "23:00"
  isOpen: boolean
  paymentTypes: PaymentType[]
  deliveryTypes: DeliveryType[]
  categories: Category[]
}

export interface GeoPoint {
  lat: number
  lng: number
}

export interface OrderItem {
  productId: string
  variantId?: string
  /** full display name, e.g. "Oddiy Hot Dog — Katta (28 sm)" */
  name: string
  price: number
  qty: number
}

export interface Customer {
  name: string
  phone: string
  tgId?: number
  tgUsername?: string
}

export interface Order {
  id: string
  number: number
  marketSlug: string
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  total: number
  customer: Customer
  deliveryType: DeliveryType
  address?: string
  location?: GeoPoint
  paymentType: PaymentType
  comment?: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
}

export interface CreateOrderInput {
  items: { productId: string; variantId?: string; qty: number }[]
  customer: Customer
  deliveryType: DeliveryType
  address?: string
  location?: GeoPoint
  paymentType: PaymentType
  comment?: string
  /** raw Telegram.WebApp.initData - backend validates it */
  initData?: string
}

export interface MarketSettings {
  name: string
  tagline?: string
  phone?: string
  phone2?: string
  address?: string
  deliveryFee: number
  minOrder: number
  freeDeliveryFrom?: number
  workingHours: { open: string; close: string }
  isOpen: boolean
  telegramGroupId?: string
  /** personal chat / channel that also receives every new order */
  telegramOwnerId?: string
  paymentTypes: PaymentType[]
  deliveryTypes: DeliveryType[]
  /** dashboard-only fields; backend stores them, frontend round-trips them */
  logo?: string
  brand?: string
  telegramBotToken?: string
  telegramBotUsername?: string
  /** promo message shown above the "open mini app" button */
  promoText?: string
  promoButtonText?: string
  /** couriers who receive every delivery order once it is accepted */
  couriers?: Courier[]
}

/** A courier: gets the full order (address, phone, map) in their private Telegram chat. */
export interface Courier {
  name: string
  /** Telegram user id, digits only (from @userinfobot) */
  tgId: string
}

export type PromoTarget = 'group' | 'owner' | 'both'

export interface PromoInput {
  text: string
  buttonText: string
  target: PromoTarget
  /** true = also pin the message in the chat */
  pin?: boolean
}

export interface PromoSentTo {
  chat: 'group' | 'owner'
  chatId: string
  messageId: number
  chatTitle?: string | null
}

export interface PromoResult {
  sent: PromoSentTo[]
}

export interface CategoryTemplate {
  id: string
  name: string
  emoji?: string | null
  sort: number
}

export interface CategoryInput {
  id?: string
  name: string
  sort?: number
}

export interface TelegramStatus {
  configured: boolean
  polling: boolean
  botUsername: string | null
  groupId: string | null
  appUrl: string
  webAppButtonsEnabled: boolean
}

export interface DashboardStats {
  today: { orders: number; revenue: number }
  week: { orders: number; revenue: number }
  month: { orders: number; revenue: number }
  byStatus: Record<OrderStatus, number>
  topProducts: { name: string; qty: number; revenue: number }[]
  daily: { date: string; orders: number; revenue: number }[]
}

export interface DashboardSession {
  token: string
  marketSlug: string
  role: 'owner' | 'staff'
  name: string
}

/* ------------------------------------------------------------- platform */

export type PlatformRole = 'admin' | 'manager'
export type ServiceAdminRole = 'owner' | 'staff'

export interface PlatformUser {
  id: number
  login: string
  name: string
  role: PlatformRole
  active: boolean
  createdAt: string
}

export interface PlatformSession {
  token: string
  user: PlatformUser
}

export interface ServiceAdmin {
  id: number
  marketSlug: string
  login: string
  name: string
  role: ServiceAdminRole
  createdAt: string
}

export interface ServiceSummary {
  slug: string
  name: string
  logo?: string
  brand?: string
  adminCount: number
}
