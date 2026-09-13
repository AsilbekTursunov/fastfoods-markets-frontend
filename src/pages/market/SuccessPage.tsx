import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useMarket } from './MarketContext'
import { api } from '@/lib/api'
import { money, mapsLink } from '@/lib/format'
import { Button, Spinner } from '@/components/ui'
import { DELIVERY_LABEL, PAYMENT_LABEL, StatusBadge } from '@/components/status'
import { tg, isTelegram } from '@/lib/telegram'
import type { Order } from '@/types'

export default function SuccessPage() {
  const { market } = useMarket()
  const { orderId = '' } = useParams()
  const state = useLocation().state as { order?: Order } | null
  const [order, setOrder] = useState<Order | null>(state?.order ?? null)

  useEffect(() => {
    if (!order) api.getOrder(market.slug, orderId).then(setOrder).catch(() => {})
  }, [market.slug, orderId, order])

  if (!order) return <Spinner className="h-screen" />

  return (
    <div className="px-4 pb-safe pt-hero">
      <div className="animate-pop text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">✅</div>
        <h1 className="mt-4 text-2xl font-extrabold">Buyurtma qabul qilindi!</h1>
        <p className="mt-1 text-gray-500">
          Buyurtma raqami <span className="font-bold text-gray-900">#{order.number}</span>
        </p>
        <p className="mt-1 text-sm text-gray-500">Operator tez orada {order.customer.phone} raqamiga bog‘lanadi.</p>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-500">Holat</span>
          <StatusBadge status={order.status} />
        </div>
        <ul className="space-y-1 text-sm">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between">
              <span>
                {i.name} <span className="text-gray-400">× {i.qty}</span>
              </span>
              <span>{money(i.price * i.qty, market.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="my-2 border-t border-dashed" />
        <div className="flex justify-between text-sm text-gray-600">
          <span>Yetkazib berish</span>
          <span>{order.deliveryFee ? money(order.deliveryFee, market.currency) : 'Bepul'}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Jami</span>
          <span>{money(order.total, market.currency)}</span>
        </div>
        <div className="mt-3 space-y-1 text-sm text-gray-600">
          <div>{order.deliveryType === 'delivery' ? '🚚' : '🏃'} {DELIVERY_LABEL[order.deliveryType]}</div>
          {order.address && <div>📍 {order.address}</div>}
          {order.location && (
            <a href={mapsLink(order.location.lat, order.location.lng)} target="_blank" rel="noreferrer" className="block text-brand underline">
              🗺 Xaritada ko‘rish
            </a>
          )}
          <div>💳 {PAYMENT_LABEL[order.paymentType]}</div>
          {order.comment && <div>💬 {order.comment}</div>}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <Link to={`/markets/${market.slug}/orders`} className="block">
          <Button full variant="secondary">Buyurtmalarim</Button>
        </Link>
        <Link to={`/markets/${market.slug}`} className="block">
          <Button full variant="ghost">Menyuga qaytish</Button>
        </Link>
        {isTelegram && (
          <Button full variant="ghost" onClick={() => tg?.close()}>
            Yopish
          </Button>
        )}
      </div>
    </div>
  )
}
