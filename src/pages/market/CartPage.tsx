import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useMarket } from './MarketContext'
import { keyOf, unitPrice, useMarketCart } from '@/store/cart'
import { money } from '@/lib/format'
import { estimateDeliveryFee, usesDistancePricing } from '@/lib/geo'
import { Button, Empty, QtyControl } from '@/components/ui'
import { haptic } from '@/lib/telegram'

export default function CartPage() {
  const { market } = useMarket()
  const cart = useMarketCart(market.slug)
  const navigate = useNavigate()

  const belowMin = cart.subtotal < market.minOrder
  // no location yet, so this is the lowest possible fee; checkout shows the exact one
  const est = estimateDeliveryFee(market, cart.subtotal, null)
  const deliveryFee = est.fee
  const distancePricing = usesDistancePricing(market)

  return (
    <div className="pb-bar-lg">
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-[#f5f5f7] px-4 pb-3 pt-safe">
        <button onClick={() => navigate(-1)} className="rounded-xl bg-white p-2 shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Savat</h1>
        {cart.count > 0 && (
          <button onClick={() => { haptic('medium'); cart.clear() }} className="ml-auto rounded-xl p-2 text-gray-500">
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {cart.lines.length === 0 ? (
        <Empty
          icon="🛒"
          title="Savat bo‘sh"
          text="Menyudan taomlar tanlang"
          action={
            <Link to={`/markets/${market.slug}`}>
              <Button>Menyuga o‘tish</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-2 px-4">
            {cart.lines.map((l) => (
              <div key={keyOf(l)} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-4xl">
                  {l.product.image && /^https?:\/\//.test(l.product.image) ? (
                    <img src={l.product.image} className="h-full w-full rounded-xl object-cover" />
                  ) : (
                    l.product.image || '🍽'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-tight">{l.product.name}</div>
                  {l.variant && <div className="text-xs text-gray-500">{l.variant.name}</div>}
                  <div className="text-sm text-gray-500">{money(unitPrice(l), market.currency)}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <QtyControl qty={l.qty} size="sm" onChange={(q) => { haptic('light'); cart.setQty(keyOf(l), q) }} />
                  <div className="text-sm font-bold">{money(l.qty * unitPrice(l), market.currency)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-4 mt-4 rounded-2xl bg-white p-4 text-sm shadow-sm">
            <Row label="Mahsulotlar" value={money(cart.subtotal, market.currency)} />
            <Row
              label="Yetkazib berish"
              value={deliveryFee === 0 ? 'Bepul' : `${money(deliveryFee, market.currency)}${distancePricing && deliveryFee > 0 ? ' dan' : ''}`}
              hint={distancePricing ? `${market.deliveryBaseKm} km gacha, keyin +${money(market.deliveryPerKm ?? 0, market.currency)}/km` : 'olib ketishda 0'}
            />
            <div className="my-2 border-t border-dashed" />
            <Row label="Jami (yetkazib berish bilan)" value={money(cart.subtotal + deliveryFee, market.currency)} bold />
            {market.freeDeliveryFrom && cart.subtotal < market.freeDeliveryFrom && (
              <div className="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">
                {money(market.freeDeliveryFrom - cart.subtotal, market.currency)} ga yana qo‘shsangiz yetkazib berish bepul
              </div>
            )}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg bg-white/90 px-4 pt-3 pb-safe backdrop-blur">
            {belowMin && (
              <div className="mb-2 text-center text-xs text-red-600">
                Minimal buyurtma {money(market.minOrder, market.currency)}
              </div>
            )}
            {!market.isOpen && <div className="mb-2 text-center text-xs text-red-600">Hozir yopiq, buyurtma qabul qilinmaydi</div>}
            <Button full size="lg" disabled={belowMin || !market.isOpen} onClick={() => navigate('../checkout')}>
              Buyurtma berish · {money(cart.subtotal, market.currency)}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, value, hint, bold }: { label: string; value: string; hint?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={bold ? 'font-bold' : 'text-gray-600'}>
        {label}
        {hint && <span className="ml-1 text-xs text-gray-400">({hint})</span>}
      </span>
      <span className={bold ? 'text-base font-bold' : 'font-medium'}>{value}</span>
    </div>
  )
}
