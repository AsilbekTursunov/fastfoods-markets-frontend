import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Market, Product } from '@/types'
import { api, ApiError } from '@/lib/api'
import { getService } from '@/config/services'
import { initTelegram, tg, isTelegram } from '@/lib/telegram'
import { ErrorBox, Spinner } from '@/components/ui'
import { OfflineBanner } from '@/components/pwa'
import { MarketContext } from './MarketContext'
import NotFound from '../NotFound'

export default function MarketLayout() {
  const { service = '' } = useParams()
  const svc = getService(service)
  const [market, setMarket] = useState<Market | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [m, p] = await Promise.all([api.getMarket(service), api.getProducts(service)])
      setMarket(m)
      setProducts(p)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true)
      else setError(e instanceof Error ? e.message : 'Xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }, [service])

  useEffect(() => {
    load()
  }, [load])

  // brand theming + telegram init
  const brand = market?.brand ?? svc?.brand
  useEffect(() => {
    if (brand) document.documentElement.style.setProperty('--brand', brand)
    initTelegram(brand)
    document.title = market?.name ?? svc?.name ?? 'FastFood Markets'
  }, [brand, market?.name, svc?.name])

  // Telegram native back button
  useEffect(() => {
    const wa = tg
    if (!wa || !isTelegram) return
    const root = `/markets/${service}`
    const isRoot = location.pathname === root || location.pathname === root + '/'
    const onBack = () => navigate(-1)
    if (isRoot) wa.BackButton.hide()
    else {
      wa.BackButton.show()
      wa.BackButton.onClick(onBack)
    }
    return () => wa.BackButton.offClick(onBack)
  }, [location.pathname, navigate, service])

  if (notFound) return <NotFound />
  if (loading && !market) return <Spinner className="h-screen" />
  if (error || !market) return <ErrorBox message={error ?? 'Xatolik'} onRetry={load} />

  return (
    <MarketContext.Provider value={{ market, products, reload: load }}>
      <div className="mx-auto min-h-full max-w-lg bg-[#f5f5f7]">
        <OfflineBanner className="m-3" />
        <Outlet />
      </div>
    </MarketContext.Provider>
  )
}
