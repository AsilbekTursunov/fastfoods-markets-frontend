import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ShoppingBag, Clock, Phone, ClipboardList } from 'lucide-react'
import { useMarket } from './MarketContext'
import { useMarketCart } from '@/store/cart'
import { money } from '@/lib/format'
import { haptic } from '@/lib/telegram'
import { QtyControl, Sheet, cn } from '@/components/ui'
import { lineKey } from '@/store/cart'
import type { Product } from '@/types'

export default function MenuPage() {
  const { market, products } = useMarket()
  const cart = useMarketCart(market.slug)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string>('')
  const [toast, setToast] = useState<string | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const tabsRef = useRef<HTMLDivElement>(null)

  const categories = useMemo(() => [...market.categories].sort((a, b) => a.sort - b.sort), [market.categories])
  const popular = useMemo(() => products.filter((p) => p.popular && p.available), [products])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
  }, [products, query])

  const grouped = useMemo(
    () =>
      categories
        .map((c) => ({ cat: c, items: filtered.filter((p) => p.categoryId === c.id) }))
        .filter((g) => g.items.length > 0),
    [categories, filtered],
  )

  // scrollspy
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.cat!
          setActive(id)
          tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${id}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
        }
      },
      { rootMargin: '-120px 0px -70% 0px' },
    )
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [grouped])

  // the market is closed: say so where the customer taps, instead of a dead button
  const closedNotice = () => {
    haptic('error')
    setToast(`Hozir yopiq. Ish vaqti ${market.workingHours.open} – ${market.workingHours.close}.`)
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const scrollTo = (id: string) => {
    haptic('select')
    const el = sectionRefs.current[id]
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 110
    window.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <div className="pb-28">
      {/* header */}
      <div className="bg-brand px-4 pb-5 pt-14 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl">{market.logo ?? '🍽'}</div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold">{market.name}</h1>
            <p className="truncate text-sm text-white/80">{market.tagline}</p>
          </div>
          <Link to="orders" className="rounded-xl bg-white/20 p-2.5" aria-label="Buyurtmalarim">
            <ClipboardList size={22} />
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/85">
          <span className="inline-flex items-center gap-1">
            <Clock size={13} /> {market.workingHours.open} – {market.workingHours.close}
          </span>
          {market.phone && (
            <a href={`tel:${market.phone}`} className="inline-flex items-center gap-1">
              <Phone size={13} /> {market.phone}
            </a>
          )}
          {market.phone2 && (
            <a href={`tel:${market.phone2}`} className="inline-flex items-center gap-1">
              <Phone size={13} /> {market.phone2}
            </a>
          )}
          <span className={cn('rounded-full px-2 font-semibold', market.isOpen ? 'bg-green-500/30' : 'bg-red-500/40')}>
            {market.isOpen ? 'Ochiq' : 'Yopiq'}
          </span>
        </div>
      </div>

      {/* search + tabs (sticky) */}
      <div className="sticky top-0 z-20 bg-[#f5f5f7] pt-3">
        <div className="px-4">
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Qidirish..."
              className="w-full bg-transparent text-[15px] outline-none"
            />
          </div>
        </div>
        {!query && (
          <div ref={tabsRef} className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-4 pb-2">
            {grouped.map(({ cat }) => (
              <button
                key={cat.id}
                data-tab={cat.id}
                onClick={() => scrollTo(cat.id)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition',
                  active === cat.id ? 'bg-brand text-white' : 'bg-white text-gray-700 shadow-sm',
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
        {!market.isOpen && (
          <div className="mx-4 mb-2 rounded-xl bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">
            🕒 Hozir yopiq. Ish vaqti {market.workingHours.open} – {market.workingHours.close}. Buyurtma qabul qilinmaydi.
          </div>
        )}
      </div>

      {/* popular */}
      {!query && popular.length > 0 && (
        <div className="mt-3">
          <h2 className="px-4 text-base font-bold">🔥 Ommabop</h2>
          <div className="no-scrollbar mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
            {popular.map((p) => (
              <div key={p.id} className="w-36 shrink-0 rounded-2xl bg-white p-3 shadow-sm">
                <div className="flex h-20 items-center justify-center rounded-xl bg-gray-50 text-4xl">
                  <ProductImage p={p} />
                </div>
                <div className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">{p.name}</div>
                <div className="mt-1 text-sm font-bold text-brand"><Price p={p} /></div>
                <AddButton p={p} cart={cart} closed={!market.isOpen} onClosedTap={closedNotice} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* sections */}
      {grouped.length === 0 && <div className="py-16 text-center text-gray-500">Hech narsa topilmadi</div>}
      {grouped.map(({ cat, items }) => (
        <div key={cat.id} data-cat={cat.id} ref={(el) => (sectionRefs.current[cat.id] = el)} className="mt-4 px-4">
          <h2 className="text-base font-bold">{cat.name}</h2>
          <div className="mt-2 space-y-2">
            {items.map((p) => (
              <div key={p.id} className={cn('flex gap-3 rounded-2xl bg-white p-3 shadow-sm', !p.available && 'opacity-50')}>
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-4xl">
                  <ProductImage p={p} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="font-semibold leading-tight">{p.name}</div>
                  {p.description && <div className="mt-0.5 line-clamp-2 text-xs text-gray-500">{p.description}</div>}
                  {p.variants && <div className="mt-0.5 line-clamp-1 text-xs text-gray-400">{p.variants.map((x) => x.name).join(' · ')}</div>}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="font-bold text-brand"><Price p={p} /></div>
                    {p.available ? <AddButton p={p} cart={cart} closed={!market.isOpen} onClosedTap={closedNotice} /> : <span className="text-xs text-gray-500">Tugagan</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-lg px-4">
          <div className="animate-pop rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">{toast}</div>
        </div>
      )}

      {/* cart bar */}
      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg px-4 pb-safe">
          <Link
            to="cart"
            className="animate-pop flex items-center justify-between rounded-2xl bg-brand px-4 py-3.5 text-white shadow-lg"
          >
            <span className="flex items-center gap-2 font-semibold">
              <ShoppingBag size={20} />
              <span className="rounded-full bg-white/25 px-2 text-sm">{cart.count}</span>
              Savat
            </span>
            <span className="font-bold">{money(cart.subtotal, market.currency)}</span>
          </Link>
        </div>
      )}
    </div>
  )
}

function ProductImage({ p }: { p: Product }) {
  if (p.image && /^https?:\/\//.test(p.image)) return <img src={p.image} alt={p.name} className="h-full w-full rounded-xl object-cover" loading="lazy" />
  return <span>{p.image || '🍽'}</span>
}

function Price({ p }: { p: Product }) {
  const { market } = useMarket()
  return (
    <>
      {money(p.price, market.currency)}
      {p.variants && <span className="ml-1 text-xs font-medium text-gray-400">dan</span>}
    </>
  )
}

function AddButton({
  p,
  cart,
  closed,
  onClosedTap,
  size = 'md',
}: {
  p: Product
  cart: ReturnType<typeof useMarketCart>
  closed?: boolean
  onClosedTap?: () => void
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const qty = cart.qtyOf(p.id)
  const wrap = size === 'sm' ? 'mt-2' : ''
  // while closed the button stays tappable on purpose: a dead button reads as a broken site
  const dim = closed ? 'opacity-50' : ''

  if (p.variants?.length) {
    return (
      <div className={wrap}>
        <button
          onClick={() => {
            if (closed) return onClosedTap?.()
            haptic('light')
            setOpen(true)
          }}
          className={cn(
            'rounded-xl font-bold transition active:scale-95',
            qty > 0 ? 'bg-brand text-white' : 'bg-brand-soft text-brand',
            size === 'sm' ? 'w-full py-1.5 text-sm' : 'px-4 py-1.5 text-sm',
            dim,
          )}
        >
          {qty > 0 ? `${qty} ta · o‘zgartirish` : 'Tanlash'}
        </button>
        <VariantSheet p={p} cart={cart} open={open} onClose={() => setOpen(false)} />
      </div>
    )
  }

  if (qty > 0)
    return (
      <div className={wrap}>
        <QtyControl qty={qty} size={size} onChange={(q) => { haptic('light'); cart.setQty(p.id, q) }} />
      </div>
    )
  return (
    <button
      onClick={() => {
        if (closed) return onClosedTap?.()
        haptic('light')
        cart.add(p)
      }}
      className={cn(
        'rounded-xl bg-brand-soft font-bold text-brand transition active:scale-95',
        size === 'sm' ? 'mt-2 w-full py-1.5 text-sm' : 'px-4 py-1.5 text-sm',
        dim,
      )}
    >
      + Qo‘shish
    </button>
  )
}

function VariantSheet({ p, cart, open, onClose }: { p: Product; cart: ReturnType<typeof useMarketCart>; open: boolean; onClose: () => void }) {
  const { market } = useMarket()
  const total = cart.lines.filter((l) => l.product.id === p.id).reduce((a, l) => a + l.qty * (l.variant?.price ?? l.product.price), 0)
  return (
    <Sheet open={open} onClose={onClose} title={p.name}>
      {p.description && <p className="-mt-1 mb-2 text-xs text-gray-500">{p.description}</p>}
      <div className="max-h-[60vh] space-y-2 overflow-y-auto pb-2">
        {p.variants!.map((v) => {
          const q = cart.qtyOfVariant(p.id, v.id)
          return (
            <div key={v.id} className={cn('flex items-center gap-3 rounded-xl border p-3', q > 0 ? 'border-brand bg-brand-soft/40' : 'border-gray-200')}>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{v.name}</div>
                {v.description && <div className="text-xs text-gray-500">{v.description}</div>}
                <div className="mt-0.5 text-sm font-bold text-brand">{money(v.price, market.currency)}</div>
              </div>
              {q > 0 ? (
                <QtyControl qty={q} onChange={(n) => { haptic('light'); cart.setQty(lineKey(p.id, v.id), n) }} />
              ) : (
                <button onClick={() => { haptic('light'); cart.add(p, v) }} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white active:scale-95">
                  +
                </button>
              )}
            </div>
          )
        })}
      </div>
      <button onClick={onClose} className="mb-2 mt-1 w-full rounded-xl bg-gray-900 py-3 font-semibold text-white">
        {total > 0 ? `Tayyor · ${money(total, market.currency)}` : 'Yopish'}
      </button>
    </Sheet>
  )
}
