import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useMarket } from './MarketContext'
import { api } from '@/lib/api'
import { money, timeAgo } from '@/lib/format'
import { getTgUser } from '@/lib/telegram'
import { Button, Empty, Spinner } from '@/components/ui'
import { StatusBadge } from '@/components/status'
import type { Order } from '@/types'

export default function MyOrdersPage() {
  const { market } = useMarket()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[] | null>(null)

  useEffect(() => {
    const tgUser = getTgUser()
    let phone: string | undefined
    try {
      phone = JSON.parse(localStorage.getItem('ffm:profile') || '{}').phone
    } catch {
      /* ignore */
    }
    api.getMyOrders(market.slug, tgUser?.id, phone).then(setOrders).catch(() => setOrders([]))
    const t = setInterval(() => api.getMyOrders(market.slug, tgUser?.id, phone).then(setOrders).catch(() => {}), 15000)
    return () => clearInterval(t)
  }, [market.slug])

  return (
    <div className="pb-safe">
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-[#f5f5f7] px-4 py-3">
        <button onClick={() => navigate(-1)} className="rounded-xl bg-white p-2 shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Buyurtmalarim</h1>
      </div>

      {orders === null ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <Empty
          icon="📦"
          title="Buyurtmalar yo‘q"
          text="Birinchi buyurtmangizni bering"
          action={
            <Link to={`/markets/${market.slug}`}>
              <Button>Menyuga o‘tish</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2 px-4">
          {orders.map((o) => (
            <Link key={o.id} to={`/markets/${market.slug}/success/${o.id}`} state={{ order: o }} className="block rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold">#{o.number}</span>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-1 line-clamp-2 text-sm text-gray-600">{o.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}</div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-400">{timeAgo(o.createdAt)}</span>
                <span className="font-bold">{money(o.total, market.currency)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
