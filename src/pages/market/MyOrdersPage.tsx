import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useMarket } from './MarketContext'
import { api } from '@/lib/api'
import { money, timeAgo } from '@/lib/format'
import { getTgUser, haptic } from '@/lib/telegram'
import { Button, Empty, Spinner, cn } from '@/components/ui'
import { StatusBadge } from '@/components/status'
import type { Order } from '@/types'

/** the customer is matched by Telegram id, or by the phone left on the last order */
function customerKeys() {
  let phone: string | undefined
  try {
    phone = JSON.parse(localStorage.getItem('ffm:profile') || '{}').phone
  } catch {
    /* no saved profile */
  }
  return { tgId: getTgUser()?.id, phone }
}

export default function MyOrdersPage() {
  const { market } = useMarket()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (manual = false) => {
      const { tgId, phone } = customerKeys()
      if (manual) {
        setRefreshing(true)
        setError(null)
        haptic('light')
      }
      try {
        setOrders(await api.getMyOrders(market.slug, tgId, phone))
      } catch (e) {
        // a background poll that fails must not wipe the list already on screen
        if (manual) setError(e instanceof Error ? e.message : 'Yangilab bo‘lmadi')
        else setOrders((prev) => prev ?? [])
      } finally {
        if (manual) setRefreshing(false)
      }
    },
    [market.slug],
  )

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div className="pb-safe">
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-[#f5f5f7] px-4 py-3">
        <button onClick={() => navigate(-1)} className="rounded-xl bg-white p-2 shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Buyurtmalarim</h1>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="ml-auto rounded-xl bg-white p-2 text-gray-600 shadow-sm disabled:opacity-60"
          aria-label="Yangilash"
        >
          <RefreshCw size={18} className={cn(refreshing && 'animate-spin')} />
        </button>
      </div>

      {error && <div className="mx-4 mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {orders === null ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <Empty
          icon="📦"
          title="Buyurtmalar yo‘q"
          text="Birinchi buyurtmangizni bering"
          action={
            <div className="flex flex-col items-center gap-2">
              <Link to={`/markets/${market.slug}`}>
                <Button>Menyuga o‘tish</Button>
              </Link>
              <Button variant="ghost" size="sm" loading={refreshing} onClick={() => load(true)}>
                <RefreshCw size={14} /> Yangilash
              </Button>
            </div>
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
