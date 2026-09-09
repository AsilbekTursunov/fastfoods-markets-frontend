import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { money } from '@/lib/format'
import { Spinner } from '@/components/ui'
import { STATUS_LABEL } from '@/components/status'
import type { DashboardStats, OrderStatus } from '@/types'

export default function StatsPage() {
  const { service = '' } = useParams()
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    api.stats(service).then(setStats).catch(() => {})
  }, [service])

  if (!stats) return <Spinner />

  const max = Math.max(1, ...stats.daily.map((d) => d.revenue))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">Statistika</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ['Bugun', stats.today],
            ['7 kun', stats.week],
            ['30 kun', stats.month],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-gray-400">{label}</div>
            <div className="mt-1 text-2xl font-extrabold">{money(v.revenue)}</div>
            <div className="text-sm text-gray-500">{v.orders} ta buyurtma</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-bold text-gray-500">Oxirgi 7 kun tushum</div>
        <div className="flex h-40 items-end gap-2">
          {stats.daily.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="text-[10px] text-gray-500">{d.orders || ''}</div>
              <div className="w-full rounded-t-lg bg-brand" style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }} title={money(d.revenue)} />
              <div className="text-[10px] text-gray-400">{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-bold text-gray-500">Top mahsulotlar</div>
          {stats.topProducts.length === 0 ? (
            <div className="text-sm text-gray-400">Hali ma’lumot yo‘q</div>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {stats.topProducts.map((p, i) => (
                <li key={p.name} className="flex justify-between">
                  <span>
                    <span className="mr-2 text-gray-400">{i + 1}.</span>
                    {p.name}
                  </span>
                  <span className="text-gray-600">
                    {p.qty} dona · {money(p.revenue)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-bold text-gray-500">Holatlar bo‘yicha</div>
          <ul className="space-y-1.5 text-sm">
            {(Object.keys(stats.byStatus) as OrderStatus[]).map((s) => (
              <li key={s} className="flex justify-between">
                <span>{STATUS_LABEL[s]}</span>
                <span className="font-semibold">{stats.byStatus[s]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
