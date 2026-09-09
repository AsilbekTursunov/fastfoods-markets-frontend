/**
 * In-browser mock backend (localStorage). Used while VITE_USE_MOCK=true.
 * Mirrors the REST contract documented in README.md so switching to the
 * real backend is a one-line env change.
 */
import type {
  Category,
  CategoryInput,
  CategoryTemplate,
  CreateOrderInput,
  DashboardSession,
  DashboardStats,
  Market,
  MarketSettings,
  Order,
  OrderStatus,
  Product,
  PromoInput,
  PromoResult,
  TelegramStatus,
} from '@/types'
import type { Api } from './api'
import { services } from '@/config/services'
import { isWithinWorkingHours } from './format'

const LS_ORDERS = 'ffm:orders'
const LS_PRODUCTS = 'ffm:products'
const LS_SETTINGS = 'ffm:settings'
const LS_CATEGORIES = 'ffm:categories'

export const DEFAULT_PROMO_TEXT = "Barcha mahsulotlarni shu yerdan ko'ring va ZAKAZ BERING!"
export const DEFAULT_PROMO_BUTTON = 'Zakaz Berish'

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

const seedCategories: Record<string, Market['categories']> = {
  totli_dunyo: [
    { id: 'hotdog', name: 'Hot Doglar', sort: 1 },
    { id: 'nonkabob', name: 'Non Kabob', sort: 2 },
    { id: 'burger', name: 'Burgerlar', sort: 3 },
    { id: 'drinks', name: 'Ichimliklar', sort: 4 },
    { id: 'cocktail', name: 'Kokteyllar', sort: 5 },
    { id: 'icecream', name: 'Muzqaymoq', sort: 6 },
  ],
  yulduzcha: [
    { id: 'burger', name: 'Burgerlar', sort: 1 },
    { id: 'drinks', name: 'Ichimliklar', sort: 2 },
  ],
  riza_food: [
    { id: 'national', name: 'Milliy taomlar', sort: 1 },
    { id: 'burger', name: 'Burgerlar', sort: 2 },
    { id: 'drinks', name: 'Ichimliklar', sort: 3 },
  ],
}

/** helper: product with size variants; price = lowest variant */
const v = (base: Omit<Product, 'price' | 'variants' | 'available'> & { available?: boolean }, variants: { id: string; name: string; price: number; description?: string }[]): Product => ({
  ...base,
  available: base.available ?? true,
  price: Math.min(...variants.map((x) => x.price)),
  variants,
})

const seedProducts: Record<string, Product[]> = {
  // Totli Dunyo — real menu. Non o'lchamlari: Kichik 17 sm, O'rtacha 24 sm, Katta 28 sm
  totli_dunyo: [
    v({ id: 'hd_oddiy', categoryId: 'hotdog', name: 'Oddiy Hot Dog', image: '🌭', popular: true }, [
      { id: 'kichik', name: 'Kichik (17 sm)', price: 8000, description: '1x sosiska, sabzi salat' },
      { id: 'kichik_plus', name: 'Kichik+ (17 sm)', price: 12000, description: '2x sosiska, sabzi salat, pomidor, bodring' },
      { id: 'orta', name: "O'rta (24 sm)", price: 15000, description: '2x sosiska, sabzi salat, pomidor, bodring' },
      { id: 'katta', name: 'Katta (28 sm)', price: 20000, description: '3x sosiska, sabzi salat, pomidor, bodring' },
    ]),
    v({ id: 'hd_canada', categoryId: 'hotdog', name: 'Canada Hot Dog', image: '🌭', popular: true }, [
      { id: 'mini', name: 'Mini (17 sm)', price: 10000, description: '1x canada sosiska, sabzi salat, pomidor, bodring' },
      { id: 'kichik', name: 'Kichik (17 sm)', price: 15000, description: '2x canada sosiska, sabzi salat, pomidor, bodring' },
      { id: 'orta', name: "O'rta (24 sm)", price: 17000, description: '2x canada sosiska, sabzi salat, pomidor, bodring' },
      { id: 'katta', name: 'Katta (28 sm)', price: 20000, description: '2x canada sosiska, sabzi salat, pomidor, bodring' },
    ]),
    v({ id: 'hd_dudlangan', categoryId: 'hotdog', name: "Dudlangan go'shtli Hot Dog", image: '🌭' }, [
      { id: 'orta', name: "O'rta (24 sm)", price: 20000, description: "2x sosiska canada, dudlangan go'sht, indeyka, bedana tuxum" },
      { id: 'katta', name: 'Katta (28 sm)', price: 25000, description: "2x sosiska canada, dudlangan go'sht, indeyka, bedana tuxum" },
    ]),
    v({ id: 'hd_qazili', categoryId: 'hotdog', name: 'Qazili Hot Dog', image: '🌭' }, [
      { id: 'orta', name: "O'rta (24 sm)", price: 25000, description: "2x sosiska canada, dudlangan go'sht, indeyka, qazi, bedana tuxum" },
      { id: 'katta', name: 'Katta (28 sm)', price: 30000, description: "2x sosiska canada, dudlangan go'sht, indeyka, qazi, bedana tuxum" },
    ]),
    v({ id: 'hd_shashlikli', categoryId: 'hotdog', name: 'Shashlikli Hot Dog', image: '🌭', popular: true }, [
      { id: 'kichik', name: 'Kichik (17 sm)', price: 27000, description: "2x sosiska canada, dudlangan go'sht, indeyka, qiyma shashlik, bedana tuxum" },
      { id: 'orta', name: "O'rta (24 sm)", price: 35000, description: "2x sosiska canada, dudlangan go'sht, indeyka, qiyma shashlik, bedana tuxum" },
      { id: 'katta', name: 'Katta (28 sm) — qazili', price: 45000, description: "2x sosiska canada, dudlangan go'sht, indeyka, qiyma shashlik, qazi, bedana tuxum" },
    ]),
    v({ id: 'nonkabob', categoryId: 'nonkabob', name: 'Non Kabob (Shashlikli)', description: 'Barcha Non Kaboblar bir xil hajmdagi nonda tayyorlanadi', image: '🍢', popular: true }, [
      { id: '1x', name: '1x qiyma', price: 17000, description: '1x qiyma, sabzi salat, pomidor, bodring' },
      { id: '2x', name: '2x qiyma', price: 25000, description: '2x qiyma, sabzi salat, pomidor, bodring' },
      { id: '3x', name: '3x qiyma', price: 35000, description: '3x qiyma, sabzi salat, pomidor, bodring, bedana tuxum' },
    ]),
    { id: 'b_gamburger', categoryId: 'burger', name: 'Gamburger', price: 25000, image: '🍔', available: true },
    { id: 'b_chizburger', categoryId: 'burger', name: 'Chizburger', price: 30000, image: '🍔', available: true, popular: true },
    { id: 'b_big', categoryId: 'burger', name: 'Big Burger', price: 35000, image: '🍔', available: true },
    { id: 'b_bigchiz', categoryId: 'burger', name: 'Big Chizburger', price: 40000, image: '🍔', available: true },
    v({ id: 'd_gazvoda', categoryId: 'drinks', name: 'Gazvoda (Yangi Chorsu)', image: '🥤' }, [
      { id: '1l', name: '1 L', price: 10000 },
      { id: '1_5l', name: '1.5 L', price: 12000 },
    ]),
    { id: 'd_ayron', categoryId: 'drinks', name: 'Ayron 1 L', price: 20000, image: '🥛', available: true },
    { id: 'd_moxito', categoryId: 'drinks', name: 'Moxito 0.5 L', price: 20000, image: '🍹', available: true },
    v({ id: 'c_sutli', categoryId: 'cocktail', name: 'Sutli kokteyl', image: '🥤' }, [
      { id: 'kichik', name: 'Kichik', price: 13000 },
      { id: 'katta', name: 'Katta', price: 20000 },
    ]),
    v({ id: 'c_shokoladli', categoryId: 'cocktail', name: 'Shokoladli kokteyl', image: '🍫' }, [
      { id: 'kichik', name: 'Kichik', price: 15000 },
      { id: 'katta', name: 'Katta', price: 25000 },
    ]),
    v({ id: 'c_bananli', categoryId: 'cocktail', name: 'Bananli kokteyl', image: '🍌' }, [
      { id: 'kichik', name: 'Kichik', price: 15000 },
      { id: 'katta', name: 'Katta', price: 25000 },
    ]),
    v({ id: 'c_malina', categoryId: 'cocktail', name: 'Malina kokteyl', image: '🍓' }, [
      { id: 'kichik', name: 'Kichik', price: 15000 },
      { id: 'katta', name: 'Katta', price: 25000 },
    ]),
    v({ id: 'c_boklashka_oddiy', categoryId: 'cocktail', name: 'Boklashka Oddiy', image: '🧋' }, [
      { id: '1l', name: '1 L', price: 40000 },
      { id: '1_5l', name: '1.5 L', price: 60000 },
    ]),
    v({ id: 'c_boklashka_mevali', categoryId: 'cocktail', name: 'Boklashka Mevali', image: '🧋' }, [
      { id: '1l', name: '1 L', price: 50000 },
      { id: '1_5l', name: '1.5 L', price: 75000 },
    ]),
    { id: 'i_molochniy', categoryId: 'icecream', name: 'Molochniy Muzqaymoq', description: '1 kg', price: 50000, image: '🍦', available: true },
  ],
  yulduzcha: [
    { id: 'y1', categoryId: 'burger', name: 'Yulduzcha Burger', price: 30000, image: '🍔', available: true, popular: true },
    { id: 'y2', categoryId: 'drinks', name: 'Cola 0.5', price: 8000, image: '🥤', available: true },
  ],
  riza_food: [
    { id: 'r1', categoryId: 'national', name: 'Osh', description: '1 porsiya', price: 35000, image: '🍛', available: true, popular: true },
    { id: 'r2', categoryId: 'national', name: 'Shashlik (1 six)', price: 18000, image: '🍢', available: true },
    { id: 'r3', categoryId: 'burger', name: 'Riza Burger', price: 29000, image: '🍔', available: true },
    { id: 'r4', categoryId: 'drinks', name: 'Ayron', price: 6000, image: '🥛', available: true },
  ],
}

function defaultSettings(slug: string): MarketSettings {
  const s = services[slug]
  return {
    name: s?.name ?? slug,
    tagline: s?.tagline,
    phone: slug === 'totli_dunyo' ? '+998 90 833 33 21' : '+998 90 123 45 67',
    phone2: slug === 'totli_dunyo' ? '+998 33 108 08 05' : undefined,
    address: 'Toshkent sh., Chilonzor tumani',
    deliveryFee: 10000,
    minOrder: 30000,
    freeDeliveryFrom: 150000,
    workingHours: { open: '09:00', close: '23:00' },
    isOpen: true,
    telegramGroupId: '',
    telegramOwnerId: '',
    promoText: DEFAULT_PROMO_TEXT,
    promoButtonText: DEFAULT_PROMO_BUTTON,
    paymentTypes: ['cash', 'card'],
    deliveryTypes: ['delivery', 'pickup'],
  }
}

function getSettings(slug: string): MarketSettings {
  const all = read<Record<string, MarketSettings>>(LS_SETTINGS, {})
  return all[slug] ?? defaultSettings(slug)
}
function saveSettings(slug: string, s: MarketSettings) {
  const all = read<Record<string, MarketSettings>>(LS_SETTINGS, {})
  all[slug] = s
  write(LS_SETTINGS, all)
}
function getProducts(slug: string): Product[] {
  const all = read<Record<string, Product[]>>(LS_PRODUCTS, {})
  return all[slug] ?? seedProducts[slug] ?? []
}
function saveProducts(slug: string, p: Product[]) {
  const all = read<Record<string, Product[]>>(LS_PRODUCTS, {})
  all[slug] = p
  write(LS_PRODUCTS, all)
}
function getOrders(): Order[] {
  return read<Order[]>(LS_ORDERS, [])
}
function saveOrders(o: Order[]) {
  write(LS_ORDERS, o)
}
function getCategories(slug: string): Category[] {
  const all = read<Record<string, Category[]>>(LS_CATEGORIES, {})
  return all[slug] ?? seedCategories[slug] ?? []
}
function saveCategories(slug: string, c: Category[]) {
  const all = read<Record<string, Category[]>>(LS_CATEGORIES, {})
  all[slug] = c
  write(LS_CATEGORIES, all)
}

const categoryTemplates: CategoryTemplate[] = [
  { id: 'hotdog', name: 'Hot Doglar', emoji: '🌭', sort: 1 },
  { id: 'burger', name: 'Burgerlar', emoji: '🍔', sort: 2 },
  { id: 'lavash', name: 'Lavash', emoji: '🌯', sort: 3 },
  { id: 'shaurma', name: 'Shaurma', emoji: '🌯', sort: 4 },
  { id: 'pizza', name: 'Pitsa', emoji: '🍕', sort: 5 },
  { id: 'nonkabob', name: 'Non Kabob', emoji: '🍢', sort: 6 },
  { id: 'shashlik', name: 'Shashlik', emoji: '🍢', sort: 7 },
  { id: 'national', name: 'Milliy taomlar', emoji: '🍛', sort: 8 },
  { id: 'soup', name: 'Sho‘rvalar', emoji: '🍲', sort: 9 },
  { id: 'salad', name: 'Salatlar', emoji: '🥗', sort: 10 },
  { id: 'fries', name: 'Fri / Garnir', emoji: '🍟', sort: 11 },
  { id: 'sauce', name: 'Souslar', emoji: '🥫', sort: 12 },
  { id: 'sweets', name: 'Shirinliklar', emoji: '🍰', sort: 13 },
  { id: 'icecream', name: 'Muzqaymoq', emoji: '🍦', sort: 14 },
  { id: 'drinks', name: 'Ichimliklar', emoji: '🥤', sort: 15 },
  { id: 'cocktail', name: 'Kokteyllar', emoji: '🧋', sort: 16 },
  { id: 'tea', name: 'Choy / Kofe', emoji: '☕', sort: 17 },
]

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[‘’'ʻ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || `c${Date.now()}`

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export const mockApi: Api = {
  async listMarkets(): Promise<Market[]> {
    return Promise.all(Object.keys(services).map((slug) => mockApi.getMarket(slug)))
  },

  async getMarket(slug: string): Promise<Market> {
    await delay()
    const svc = services[slug]
    if (!svc) throw new Error('Market topilmadi')
    const s = getSettings(slug)
    return {
      slug,
      name: s.name,
      tagline: s.tagline,
      logo: svc.logo,
      brand: svc.brand,
      phone: s.phone,
      phone2: s.phone2,
      address: s.address,
      currency: "so'm",
      deliveryFee: s.deliveryFee,
      minOrder: s.minOrder,
      freeDeliveryFrom: s.freeDeliveryFrom,
      workingHours: s.workingHours,
      isOpen: s.isOpen && isWithinWorkingHours(s.workingHours.open, s.workingHours.close),
      paymentTypes: s.paymentTypes,
      deliveryTypes: s.deliveryTypes,
      categories: getCategories(slug),
    }
  },

  async getProducts(slug: string): Promise<Product[]> {
    await delay()
    return getProducts(slug)
  },

  async createOrder(slug: string, input: CreateOrderInput): Promise<Order> {
    await delay(500)
    const products = getProducts(slug)
    const s = getSettings(slug)
    const items = input.items.map((i) => {
      const p = products.find((x) => x.id === i.productId)
      if (!p) throw new Error('Mahsulot topilmadi')
      const variant = p.variants?.find((x) => x.id === i.variantId)
      if (p.variants?.length && !variant) throw new Error(`${p.name}: o'lcham tanlanmagan`)
      return {
        productId: p.id,
        variantId: variant?.id,
        name: variant ? `${p.name} — ${variant.name}` : p.name,
        price: variant?.price ?? p.price,
        qty: i.qty,
      }
    })
    const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0)
    let deliveryFee = input.deliveryType === 'delivery' ? s.deliveryFee : 0
    if (s.freeDeliveryFrom && subtotal >= s.freeDeliveryFrom) deliveryFee = 0
    const orders = getOrders()
    const marketOrders = orders.filter((o) => o.marketSlug === slug)
    const now = new Date().toISOString()
    const order: Order = {
      id: `${slug}-${Date.now()}`,
      number: (marketOrders.at(-1)?.number ?? 1000) + 1,
      marketSlug: slug,
      items,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      customer: input.customer,
      deliveryType: input.deliveryType,
      address: input.address,
      location: input.location,
      paymentType: input.paymentType,
      comment: input.comment,
      status: 'new',
      createdAt: now,
      updatedAt: now,
    }
    orders.push(order)
    saveOrders(orders)
    const chats = [s.telegramGroupId, s.telegramOwnerId].filter(Boolean)
    console.info(`[mock] Telegram → ${chats.length ? chats.join(', ') : 'no chat configured'}:\n` + buildGroupMessage(order, s.name))
    return order
  },

  async getMyOrders(slug: string, tgId?: number, phone?: string): Promise<Order[]> {
    await delay()
    return getOrders()
      .filter((o) => o.marketSlug === slug)
      .filter((o) => (tgId && o.customer.tgId === tgId) || (phone && o.customer.phone === phone))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async getOrder(slug: string, id: string): Promise<Order> {
    await delay()
    const o = getOrders().find((x) => x.marketSlug === slug && x.id === id)
    if (!o) throw new Error('Buyurtma topilmadi')
    return o
  },

  /* ---------------- dashboard ---------------- */

  async login(slug: string, login: string, password: string): Promise<DashboardSession> {
    await delay(400)
    if (login === 'admin' && password === 'admin') {
      return { token: `mock-${slug}-${Date.now()}`, marketSlug: slug, role: 'owner', name: 'Admin' }
    }
    throw new Error("Login yoki parol noto'g'ri")
  },

  async me(slug: string) {
    await delay(100)
    return { marketSlug: slug, role: 'owner' as const, name: 'Admin' }
  },

  async dashboardOrders(slug: string, status?: OrderStatus | 'active'): Promise<Order[]> {
    await delay(200)
    let list = getOrders().filter((o) => o.marketSlug === slug)
    if (status === 'active') list = list.filter((o) => !['done', 'cancelled'].includes(o.status))
    else if (status) list = list.filter((o) => o.status === status)
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async updateOrderStatus(slug: string, id: string, status: OrderStatus): Promise<Order> {
    await delay(200)
    const orders = getOrders()
    const o = orders.find((x) => x.marketSlug === slug && x.id === id)
    if (!o) throw new Error('Buyurtma topilmadi')
    o.status = status
    o.updatedAt = new Date().toISOString()
    saveOrders(orders)
    return o
  },

  async dashboardProducts(slug: string): Promise<Product[]> {
    await delay(200)
    return getProducts(slug)
  },

  async upsertProduct(slug: string, product: Product): Promise<Product> {
    await delay(200)
    const list = getProducts(slug)
    if (product.variants?.length) product = { ...product, price: Math.min(...product.variants.map((x) => x.price)) }
    else product = { ...product, variants: undefined }
    if (!product.id) product = { ...product, id: `p${Date.now()}` }
    const idx = list.findIndex((p) => p.id === product.id)
    if (idx >= 0) list[idx] = product
    else list.push(product)
    saveProducts(slug, list)
    return product
  },

  async deleteProduct(slug: string, id: string): Promise<void> {
    await delay(200)
    saveProducts(slug, getProducts(slug).filter((p) => p.id !== id))
  },

  async categories(slug: string): Promise<Category[]> {
    await delay(150)
    return [...getCategories(slug)].sort((a, b) => a.sort - b.sort)
  },

  async categoryTemplates(): Promise<CategoryTemplate[]> {
    await delay(150)
    return categoryTemplates
  },

  async createCategory(slug: string, c: CategoryInput): Promise<Category> {
    await delay(200)
    const list = getCategories(slug)
    const id = c.id || slugify(c.name)
    if (list.some((x) => x.id === id)) throw new Error('Bunday kategoriya allaqachon bor')
    const cat: Category = { id, name: c.name, sort: c.sort ?? (Math.max(0, ...list.map((x) => x.sort)) + 1) }
    saveCategories(slug, [...list, cat])
    return cat
  },

  async updateCategory(slug: string, id: string, c: CategoryInput): Promise<Category> {
    await delay(200)
    const list = getCategories(slug)
    const idx = list.findIndex((x) => x.id === id)
    if (idx < 0) throw new Error('Kategoriya topilmadi')
    list[idx] = { ...list[idx], name: c.name, sort: c.sort ?? list[idx].sort }
    saveCategories(slug, list)
    return list[idx]
  },

  async deleteCategory(slug: string, id: string): Promise<void> {
    await delay(200)
    const used = getProducts(slug).filter((p) => p.categoryId === id).length
    if (used) throw new Error(`Kategoriyada ${used} ta mahsulot bor. Avval ularni boshqa kategoriyaga o'tkazing`)
    saveCategories(slug, getCategories(slug).filter((x) => x.id !== id))
  },

  async uploadImage(_slug: string, file: File): Promise<string> {
    await delay(300)
    if (file.size > 5 * 1024 * 1024) throw new Error('Rasm 5 MB dan katta')
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(new Error('Rasm o‘qilmadi'))
      r.readAsDataURL(file)
    })
  },

  async telegramStatus(slug: string): Promise<TelegramStatus> {
    await delay(150)
    const s = getSettings(slug)
    return {
      configured: !!s.telegramBotToken,
      polling: !!s.telegramBotToken,
      botUsername: s.telegramBotToken ? services[slug]?.botUsername ?? null : null,
      groupId: s.telegramGroupId || null,
      appUrl: `${location.origin}/markets/${slug}`,
      webAppButtonsEnabled: location.protocol === 'https:',
    }
  },

  async telegramTest(slug: string) {
    await delay(400)
    const s = getSettings(slug)
    if (!s.telegramBotToken) throw new Error('Bot token kiritilmagan')
    if (!s.telegramGroupId) throw new Error('Guruh chat ID kiritilmagan')
    console.info(`[mock] test message sent to ${s.telegramGroupId}`)
    return { ok: true, chatId: s.telegramGroupId, chatTitle: 'Mock guruh' }
  },

  async sendPromo(slug: string, input: PromoInput): Promise<PromoResult> {
    await delay(500)
    const s = getSettings(slug)
    if (!s.telegramBotToken) throw new Error('Bot token kiritilmagan')
    const targets: { chat: 'group' | 'owner'; chatId?: string }[] = []
    if (input.target !== 'owner') targets.push({ chat: 'group', chatId: s.telegramGroupId })
    if (input.target !== 'group') targets.push({ chat: 'owner', chatId: s.telegramOwnerId })
    const usable = targets.filter((t) => !!t.chatId)
    if (!usable.length) throw new Error('Chat ID kiritilmagan')
    console.info(`[mock] promo → ${usable.map((t) => t.chatId).join(', ')}\n${input.text}\n[ ${input.buttonText} → /markets/${slug} ]`)
    return {
      sent: usable.map((t) => ({ chat: t.chat, chatId: t.chatId!, messageId: Math.floor(Math.random() * 10000), chatTitle: 'Mock chat' })),
    }
  },

  async getSettings(slug: string): Promise<MarketSettings> {
    await delay(200)
    return getSettings(slug)
  },

  async updateSettings(slug: string, s: MarketSettings): Promise<MarketSettings> {
    await delay(200)
    saveSettings(slug, s)
    return s
  },

  async stats(slug: string): Promise<DashboardStats> {
    await delay(200)
    const orders = getOrders().filter((o) => o.marketSlug === slug)
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const week = startOfDay - 6 * 86400000
    const month = startOfDay - 29 * 86400000
    const done = orders.filter((o) => o.status !== 'cancelled')
    const agg = (from: number) => {
      const l = done.filter((o) => new Date(o.createdAt).getTime() >= from)
      return { orders: l.length, revenue: l.reduce((a, o) => a + o.total, 0) }
    }
    const byStatus: Record<OrderStatus, number> = { new: 0, accepted: 0, preparing: 0, delivering: 0, done: 0, cancelled: 0 }
    orders.forEach((o) => byStatus[o.status]++)
    const prodMap = new Map<string, { name: string; qty: number; revenue: number }>()
    done.forEach((o) =>
      o.items.forEach((i) => {
        const e = prodMap.get(i.name) ?? { name: i.name, qty: 0, revenue: 0 }
        e.qty += i.qty
        e.revenue += i.qty * i.price
        prodMap.set(i.name, e)
      }),
    )
    const daily = Array.from({ length: 7 }, (_, k) => {
      const d = new Date(startOfDay - (6 - k) * 86400000)
      const dayEnd = d.getTime() + 86400000
      const l = done.filter((o) => {
        const t = new Date(o.createdAt).getTime()
        return t >= d.getTime() && t < dayEnd
      })
      return { date: d.toISOString().slice(0, 10), orders: l.length, revenue: l.reduce((a, o) => a + o.total, 0) }
    })
    return {
      today: agg(startOfDay),
      week: agg(week),
      month: agg(month),
      byStatus,
      topProducts: [...prodMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
      daily,
    }
  },
}

/** Same text the backend should send to the market's Telegram group. */
export function buildGroupMessage(o: Order, marketName: string): string {
  const lines = [
    `🆕 Yangi buyurtma #${o.number} — ${marketName}`,
    '',
    `👤 ${o.customer.name}${o.customer.tgUsername ? ` (@${o.customer.tgUsername})` : ''}`,
    `📞 ${o.customer.phone}`,
    o.deliveryType === 'delivery' ? `🚚 Yetkazib berish` : `🏃 Olib ketish`,
    o.address ? `📍 ${o.address}` : '',
    o.location ? `🗺 https://maps.google.com/?q=${o.location.lat},${o.location.lng}` : '',
    '',
    ...o.items.map((i) => `• ${i.name} × ${i.qty} = ${(i.price * i.qty).toLocaleString('ru-RU')}`),
    '',
    o.deliveryFee ? `Yetkazish: ${o.deliveryFee.toLocaleString('ru-RU')}` : '',
    `💰 Jami: ${o.total.toLocaleString('ru-RU')} so'm`,
    `💳 To'lov: ${o.paymentType}`,
    o.comment ? `💬 ${o.comment}` : '',
  ]
  return lines.filter((l) => l !== '').join('\n')
}
