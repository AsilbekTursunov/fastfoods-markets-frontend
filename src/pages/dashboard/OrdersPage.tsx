import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { RefreshCw, Phone, MapPin, Volume2, VolumeX } from 'lucide-react'
import { api } from '@/lib/api'
import { money, formatDateTime, timeAgo, mapsLink } from '@/lib/format'
import { Button, Spinner, cn } from '@/components/ui'
import { markSynced } from '@/lib/offline'
import { DELIVERY_LABEL, PAYMENT_LABEL, STATUS_FLOW, STATUS_LABEL, StatusBadge } from '@/components/status'
import type { Order, OrderStatus } from '@/types'

type Filter = 'active' | OrderStatus | 'all'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'active', label: 'Faol' },
  { value: 'new', label: 'Yangi' },
  { value: 'accepted', label: 'Qabul qilingan' },
  { value: 'preparing', label: 'Tayyorlanmoqda' },
  { value: 'delivering', label: 'Yo‘lda' },
  { value: 'done', label: 'Yakunlangan' },
  { value: 'cancelled', label: 'Bekor' },
  { value: 'all', label: 'Hammasi' },
]

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = 880
    g.gain.setValueAtTime(0.2, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    o.start()
    o.stop(ctx.currentTime + 0.6)
  } catch {
    /* ignore */
  }
}

export default function OrdersPage() {
  const { service = '' } = useParams()
  const [filter, setFilter] = useState<Filter>('active')
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [sound, setSound] = useState(() => localStorage.getItem('ffm:sound') !== 'off')
  const knownIds = useRef<Set<string> | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const list = await api.dashboardOrders(service, filter === 'all' ? undefined : filter)
        // detect new orders for sound + browser notification
        const all = filter === 'active' || filter === 'new' || filter === 'all' ? list : null
        if (all) {
          if (knownIds.current) {
            const fresh = all.filter((o) => o.status === 'new' && !knownIds.current!.has(o.id))
            if (fresh.length) {
              if (sound) beep()
              if (Notification?.permission === 'granted') {
                fresh.forEach((o) => new Notification(`Yangi buyurtma #${o.number}`, { body: `${o.customer.name} · ${money(o.total)}` }))
              }
            }
          }
          knownIds.current = new Set(all.map((o) => o.id))
        }
        setOrders(list)
        markSynced(`orders:${service}`)
      } finally {
        setLoading(false)
      }
    },
    [service, filter, sound],
  )

  useEffect(() => {
    knownIds.current = null
    load()
    const t = setInterval(() => load(true), 10000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
  }, [])

  const setStatus = async (o: Order, status: OrderStatus) => {
    const updated = await api.updateOrderStatus(service, o.id, status)
    setOrders((list) => list?.map((x) => (x.id === o.id ? updated : x)) ?? null)
  }

  const toggleSound = () => {
    const v = !sound
    setSound(v)
    localStorage.setItem('ffm:sound', v ? 'on' : 'off')
    if (v) beep()
  }

  const counts = orders ? { new: orders.filter((o) => o.status === 'new').length } : { new: 0 }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-xl font-extrabold">Buyurtmalar</h1>
        {counts.new > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{counts.new} yangi</span>}
        <div className="ml-auto flex gap-1">
          <button onClick={toggleSound} className="rounded-xl bg-white p-2 text-gray-600 shadow-sm" title="Ovoz">
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button onClick={() => load()} className={cn('rounded-xl bg-white p-2 text-gray-600 shadow-sm', loading && 'animate-spin')} title="Yangilash">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold', filter === f.value ? 'bg-brand text-white' : 'bg-white text-gray-700 shadow-sm')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {orders === null ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <div className="py-20 text-center text-gray-500">Buyurtmalar yo‘q</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} onStatus={(s) => setStatus(o, s)} />
          ))}
        </div>
      )}
    </div>
  )
}

function OrderCard({ order: o, onStatus }: { order: Order; onStatus: (s: OrderStatus) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const nextIdx = STATUS_FLOW.indexOf(o.status)
  const next = nextIdx >= 0 && nextIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[nextIdx + 1] : null
  const isFinal = o.status === 'done' || o.status === 'cancelled'

  const go = async (s: OrderStatus) => {
    if (s === 'cancelled' && !confirm(`#${o.number} buyurtmani bekor qilasizmi?`)) return
    setBusy(true)
    try {
      await onStatus(s)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex flex-col rounded-2xl bg-white p-4 shadow-sm', o.status === 'new' && 'ring-2 ring-blue-400')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-extrabold">#{o.number}</div>
          <div className="text-xs text-gray-400" title={formatDateTime(o.createdAt)}>
            {timeAgo(o.createdAt)}
          </div>
        </div>
        <StatusBadge status={o.status} />
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <div className="font-semibold">
          {o.customer.name}
          {o.customer.tgUsername && (
            <a href={`https://t.me/${o.customer.tgUsername}`} target="_blank" rel="noreferrer" className="ml-1 font-normal text-blue-600">
              @{o.customer.tgUsername}
            </a>
          )}
        </div>
        <a href={`tel:${o.customer.phone}`} className="inline-flex items-center gap-1 text-brand">
          <Phone size={14} /> {o.customer.phone}
        </a>
        <div className="text-gray-600">
          {o.deliveryType === 'delivery' ? '🚚' : '🏃'} {DELIVERY_LABEL[o.deliveryType]} · 💳 {PAYMENT_LABEL[o.paymentType]}
        </div>
        {o.address && (
          <div className="flex items-start gap-1 text-gray-700">
            <MapPin size={14} className="mt-0.5 shrink-0" /> {o.address}
          </div>
        )}
        {o.location && (
          <a href={mapsLink(o.location.lat, o.location.lng)} target="_blank" rel="noreferrer" className="inline-block text-blue-600 underline">
            🗺 Xaritada ochish
          </a>
        )}
        {o.comment && <div className="rounded-lg bg-amber-50 px-2 py-1 text-amber-800">💬 {o.comment}</div>}
      </div>

      <ul className="mt-3 space-y-0.5 border-t border-dashed pt-2 text-sm">
        {o.items.map((i, idx) => (
          <li key={idx} className="flex justify-between">
            <span>
              {i.name} <span className="font-bold text-brand">×{i.qty}</span>
            </span>
            <span className="text-gray-600">{money(i.price * i.qty)}</span>
          </li>
        ))}
        {o.deliveryFee > 0 && (
          <li className="flex justify-between text-gray-500">
            <span>Yetkazish</span>
            <span>{money(o.deliveryFee)}</span>
          </li>
        )}
        <li className="flex justify-between border-t pt-1 font-bold">
          <span>Jami</span>
          <span>{money(o.total)}</span>
        </li>
      </ul>

      {!isFinal && (
        <div className="mt-3 flex gap-2">
          {next && (
            <Button full size="sm" loading={busy} onClick={() => go(next)}>
              {next === 'accepted' ? '✅ Qabul qilish' : next === 'preparing' ? '👨‍🍳 Tayyorlash' : next === 'delivering' ? '🚚 Yo‘lga' : '🏁 Yakunlash'}
            </Button>
          )}
          {o.status === 'preparing' && o.deliveryType === 'pickup' && (
            <Button size="sm" variant="ghost" loading={busy} onClick={() => go('done')}>
              🏁 Berildi
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-red-600" disabled={busy} onClick={() => go('cancelled')}>
            ✕
          </Button>
        </div>
      )}
      {isFinal && (
        <div className="mt-3 text-xs text-gray-400">
          {STATUS_LABEL[o.status]} · {formatDateTime(o.updatedAt)}
        </div>
      )}
    </div>
  )
}
