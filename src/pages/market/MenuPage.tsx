import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ShoppingBag, Clock, Phone, ClipboardList, Plus } from 'lucide-react'
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
		<div className='pb-bar'>
			{/* header: pt-hero keeps it clear of the notch and the Telegram header */}
			<div className='bg-brand px-4 pb-5 pt-hero text-white'>
				<div className='flex items-center gap-3'>
					<div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl'>
						{market.logo ?? '🍽'}
					</div>
					<div className='min-w-0 flex-1'>
						<h1 className='truncate text-xl font-extrabold'>{market.name}</h1>
						<p className='truncate text-sm text-white/80'>{market.tagline}</p>
					</div>
					<Link to='orders' className='rounded-xl bg-white/20 p-2.5' aria-label='Buyurtmalarim'>
						<ClipboardList size={22} />
					</Link>
				</div>
				<div className='mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/85'>
					<span className='inline-flex items-center gap-1'>
						<Clock size={13} /> {market.workingHours.open} – {market.workingHours.close}
					</span>
					{market.phone && (
						<a href={`tel:${market.phone}`} className='inline-flex items-center gap-1'>
							<Phone size={13} /> {market.phone}
						</a>
					)}
					{market.phone2 && (
						<a href={`tel:${market.phone2}`} className='inline-flex items-center gap-1'>
							<Phone size={13} /> {market.phone2}
						</a>
					)}
					<span
						className={cn(
							'rounded-full px-2 font-semibold',
							market.isOpen ? 'bg-green-500/30' : 'bg-red-500/40',
						)}
					>
						{market.isOpen ? 'Ochiq' : 'Yopiq'}
					</span>
				</div>
			</div>

			{/* search + tabs (sticky) */}
			<div className='sticky top-0 z-20 bg-[#f5f5f7] pt-3'>
				<div className='px-4'>
					<div className='flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm'>
						<Search size={18} className='text-gray-400' />
						<input
							value={query}
							onChange={e => setQuery(e.target.value)}
							placeholder='Qidirish...'
							className='w-full bg-transparent text-[15px] outline-none'
						/>
					</div>
				</div>
				{!query && (
					<div ref={tabsRef} className='no-scrollbar mt-2 flex gap-2 overflow-x-auto px-4 pb-2'>
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
					<div className='mx-4 mb-2 rounded-xl bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900'>
						🕒 Hozir yopiq. Ish vaqti {market.workingHours.open} – {market.workingHours.close}.
						Buyurtma qabul qilinmaydi.
					</div>
				)}
			</div>

			{/* popular */}
			{!query && popular.length > 0 && (
				<div className='mt-3'>
					<h2 className='px-4 text-base font-bold'>🔥 Ommabop</h2>
					{/* pb-10 leaves room for the 40px blur of the card shadow; snap keeps one card centred after a swipe */}
					<div className='no-scrollbar mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-10 pt-2'>
						{popular.map(p => (
							<PopularCard
								key={p.id}
								p={p}
								cart={cart}
								closed={!market.isOpen}
								onClosedTap={closedNotice}
							/>
						))}
					</div>
				</div>
			)}

			{/* sections */}
			{grouped.length === 0 && (
				<div className='py-16 text-center text-gray-500'>Hech narsa topilmadi</div>
			)}
			{grouped.map(({ cat, items }) => (
				<div
					key={cat.id}
					data-cat={cat.id}
					ref={el => (sectionRefs.current[cat.id] = el)}
					className='mt-4 px-4'
				>
					<h2 className='text-base font-bold'>{cat.name}</h2>
					<div className='mt-2 grid grid-cols-2 gap-3'>
						{items.map(p => (
							<ProductCard
								key={p.id}
								p={p}
								cart={cart}
								closed={!market.isOpen}
								onClosedTap={closedNotice}
							/>
						))}
					</div>
				</div>
			))}

			{toast && (
				<div className='fixed inset-x-0 bottom-24 z-40 mx-auto max-w-lg px-4'>
					<div className='animate-pop rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-medium text-white shadow-lg'>
						{toast}
					</div>
				</div>
			)}

			{/* cart bar */}
			{cart.count > 0 && (
				<div className='fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg px-4 pb-safe'>
					<Link
						to='cart'
						className='animate-pop flex items-center justify-between rounded-2xl bg-brand px-4 py-3.5 text-white shadow-lg'
					>
						<span className='flex items-center gap-2 font-semibold'>
							<ShoppingBag size={20} />
							<span className='rounded-full bg-white/25 px-2 text-sm'>{cart.count}</span>
							Savat
						</span>
						<span className='font-bold'>{money(cart.subtotal, market.currency)}</span>
					</Link>
				</div>
			)}
		</div>
	)
}

/**
 * "Ommabop" showcase card, fixed 261×416: edge-to-edge picture with the price tag sitting on
 * it, centred name and description, full-width dark button pinned to the bottom.
 * Sizes are literal on purpose — the design spec gives them in pixels.
 */
function PopularCard({ p, cart, closed, onClosedTap }: { p: Product; cart: ReturnType<typeof useMarketCart>; closed?: boolean; onClosedTap?: () => void }) {
  const { market } = useMarket()
  const [open, setOpen] = useState(false)
  const qty = cart.qtyOf(p.id)
  const hasVariants = !!p.variants?.length
  const isUrl = !!p.image && /^https?:\/\//.test(p.image)
  const discount = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0
  const dark = 'bg-[#052014] text-white'

  const add = () => {
    if (closed) return onClosedTap?.()
    haptic('light')
    if (hasVariants) setOpen(true)
    else cart.add(p)
  }

  return (
		<div className='flex  w-[261px] shrink-0 snap-start flex-col overflow-hidden rounded-[10px] bg-white border border-gray-200'>
			<div className='relative h-[232px] w-full shrink-0 bg-gray-50'>
				{isUrl ? (
					<img src={p.image} alt={p.name} className='h-full w-full object-cover' loading='lazy' />
				) : (
					<div className='flex h-full w-full items-center justify-center text-7xl'>
						{p.image || '🍽'}
					</div>
				)}
				{discount > 0 && (
					<span className='absolute left-3 top-3 rounded-md bg-yellow-300 px-2 py-0.5 text-xs font-extrabold text-gray-900 shadow-sm'>
						−{discount}%
					</span>
				)}
				<span className='absolute bottom-3 left-3 rounded-md bg-brand px-3 py-1.5 text-sm font-bold text-white shadow-md'>
					{money(p.price, market.currency)}
					{hasVariants && <span className='ml-1 text-xs font-medium opacity-80'>dan</span>}
				</span>
				{!p.available && (
					<span className='absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-xs font-semibold text-white'>
						Tugagan
					</span>
				)}
			</div>

			<div className='flex min-h-0 flex-1 justify-between flex-col p-2 text-center'>
				<div className='line-clamp-2 text-lg font-bold leading-tight'>{p.name}</div>
				{(p.description || hasVariants) && (
					<div className='mt-1 line-clamp-2 text-sm leading-snug text-gray-500'>
						{p.description || p.variants!.map(x => x.name).join(' · ')}
					</div>
				)}
				<div className=' pt-2'>
					{!p.available ? (
						<div className='flex h-[52px] items-center justify-center rounded-[10px] bg-gray-200 text-sm font-semibold text-gray-500'>
							Tugagan
						</div>
					) : qty > 0 && !hasVariants ? (
						<div
							className={cn('flex h-[52px] items-center justify-between rounded-[10px] px-2', dark)}
						>
							<button
								onClick={() => {
									haptic('light')
									cart.setQty(p.id, qty - 1)
								}}
								className='h-10 w-10 rounded-lg text-xl font-bold active:bg-white/10'
								aria-label='Kamaytirish'
							>
								−
							</button>
							<span className='text-base font-bold'>{qty}</span>
							<button
								onClick={() => {
									haptic('light')
									cart.setQty(p.id, qty + 1)
								}}
								className='h-10 w-10 rounded-lg text-xl font-bold active:bg-white/10'
								aria-label='Ko‘paytirish'
							>
								+
							</button>
						</div>
					) : (
						<button
							onClick={add}
							className={cn(
								'h-[52px] w-full rounded-[10px] text-sm font-semibold transition active:scale-[0.98]',
								dark,
								closed && 'opacity-60',
							)}
						>
							{qty > 0 ? `${qty} ta · o‘zgartirish` : hasVariants ? 'Tanlash' : 'Savatga qo‘shish'}
						</button>
					)}
				</div>
			</div>

			{hasVariants && <VariantSheet p={p} cart={cart} open={open} onClose={() => setOpen(false)} />}
		</div>
	)
}

/**
 * Marketplace-style card: big square picture, discount badge, round "+" on the picture,
 * then price (old price struck through), name and a one-line description.
 */
function ProductCard({
	p,
	cart,
	closed,
	onClosedTap,
	className,
}: {
	p: Product
	cart: ReturnType<typeof useMarketCart>
	closed?: boolean
	onClosedTap?: () => void
	className?: string
}) {
	const { market } = useMarket()
	const [open, setOpen] = useState(false)
	const qty = cart.qtyOf(p.id)
	const hasVariants = !!p.variants?.length
	const isUrl = !!p.image && /^https?:\/\//.test(p.image)
	const discount =
		p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0

	// while closed the button stays tappable on purpose: a dead button reads as a broken site
	const onPlus = () => {
		if (closed) return onClosedTap?.()
		haptic('light')
		if (hasVariants) setOpen(true)
		else cart.add(p)
	}

	return (
		<div
			className={cn(
				'flex flex-col rounded-2xl bg-white p-2 shadow-sm',
				!p.available && 'opacity-60',
				className,
			)}
		>
			<div className='relative aspect-square w-full overflow-hidden rounded-xl bg-gray-50'>
				{isUrl ? (
					<img src={p.image} alt={p.name} className='h-full w-full object-cover' loading='lazy' />
				) : (
					<div className='flex h-full w-full items-center justify-center text-6xl'>
						{p.image || '🍽'}
					</div>
				)}

				{discount > 0 && (
					<span className='absolute left-2 top-2 rounded-lg bg-yellow-300 px-2 py-0.5 text-xs font-extrabold text-gray-900 shadow-sm'>
						−{discount}%
					</span>
				)}

				{!p.available && (
					<span className='absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-xs font-semibold text-white'>
						Tugagan
					</span>
				)}

				{p.available && (
					<div className='absolute bottom-2 right-2'>
						{qty > 0 && !hasVariants ? (
							<div className='rounded-xl bg-white shadow-md'>
								<QtyControl
									qty={qty}
									size='sm'
									onChange={q => {
										haptic('light')
										cart.setQty(p.id, q)
									}}
								/>
							</div>
						) : (
							<button
								onClick={onPlus}
								className={cn(
									'flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand shadow-md transition active:scale-95',
									closed && 'opacity-60',
								)}
								aria-label={qty > 0 ? 'O‘zgartirish' : 'Qo‘shish'}
							>
								{qty > 0 ? (
									<span className='text-sm font-extrabold'>{qty}</span>
								) : (
									<Plus size={22} strokeWidth={2.75} />
								)}
							</button>
						)}
					</div>
				)}
			</div>

			<div className='mt-2 px-1 pb-1'>
				<div className='text-lg font-extrabold leading-tight text-brand'>
					{money(p.price, market.currency)}
					{hasVariants && <span className='ml-1 text-xs font-medium text-gray-400'>dan</span>}
				</div>
				{discount > 0 && (
					<div className='text-sm text-gray-400 line-through'>
						{money(p.oldPrice!, market.currency)}
					</div>
				)}
				<div className='mt-1 line-clamp-2 text-[15px] font-medium leading-snug'>{p.name}</div>
				{(p.description || hasVariants) && (
					<div className='mt-0.5 line-clamp-1 text-sm text-gray-400'>
						{p.description || p.variants!.map(x => x.name).join(' · ')}
					</div>
				)}
			</div>

			{hasVariants && <VariantSheet p={p} cart={cart} open={open} onClose={() => setOpen(false)} />}
		</div>
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
