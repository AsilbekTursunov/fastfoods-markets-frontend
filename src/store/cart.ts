import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, ProductVariant } from '@/types'

export interface CartLine {
  product: Product
  variant?: ProductVariant
  qty: number
}

export const lineKey = (productId: string, variantId?: string) => (variantId ? `${productId}:${variantId}` : productId)
export const keyOf = (l: CartLine) => lineKey(l.product.id, l.variant?.id)
export const unitPrice = (l: CartLine) => l.variant?.price ?? l.product.price
export const lineName = (l: CartLine) => (l.variant ? `${l.product.name} — ${l.variant.name}` : l.product.name)

interface CartState {
  /** carts keyed by market slug so switching markets keeps separate baskets */
  carts: Record<string, CartLine[]>
  add: (slug: string, product: Product, variant?: ProductVariant) => void
  setQty: (slug: string, key: string, qty: number) => void
  clear: (slug: string) => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      carts: {},
      add: (slug, product, variant) =>
        set((s) => {
          const lines = s.carts[slug] ?? []
          const key = lineKey(product.id, variant?.id)
          const idx = lines.findIndex((l) => keyOf(l) === key)
          const next = idx >= 0 ? lines.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l)) : [...lines, { product, variant, qty: 1 }]
          return { carts: { ...s.carts, [slug]: next } }
        }),
      setQty: (slug, key, qty) =>
        set((s) => {
          const lines = s.carts[slug] ?? []
          const next = qty <= 0 ? lines.filter((l) => keyOf(l) !== key) : lines.map((l) => (keyOf(l) === key ? { ...l, qty } : l))
          return { carts: { ...s.carts, [slug]: next } }
        }),
      clear: (slug) => set((s) => ({ carts: { ...s.carts, [slug]: [] } })),
    }),
    { name: 'ffm:cart', version: 2, migrate: () => ({ carts: {} }) as CartState },
  ),
)

const EMPTY: CartLine[] = []

export function useMarketCart(slug: string) {
  const lines = useCart((s) => s.carts[slug] ?? EMPTY)
  const add = useCart((s) => s.add)
  const setQty = useCart((s) => s.setQty)
  const clear = useCart((s) => s.clear)
  const count = lines.reduce((a, l) => a + l.qty, 0)
  const subtotal = lines.reduce((a, l) => a + l.qty * unitPrice(l), 0)
  /** total qty of a product across all its variants */
  const qtyOf = (productId: string) => lines.filter((l) => l.product.id === productId).reduce((a, l) => a + l.qty, 0)
  const qtyOfVariant = (productId: string, variantId: string) => lines.find((l) => keyOf(l) === lineKey(productId, variantId))?.qty ?? 0
  return {
    lines,
    count,
    subtotal,
    qtyOf,
    qtyOfVariant,
    add: (p: Product, v?: ProductVariant) => add(slug, p, v),
    setQty: (key: string, q: number) => setQty(slug, key, q),
    clear: () => clear(slug),
  }
}
