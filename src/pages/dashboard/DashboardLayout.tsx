import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { ClipboardList, Package, BarChart3, Settings, LogOut, ExternalLink, ShieldCheck } from 'lucide-react'
import { getService } from '@/config/services'
import { api, ApiError, getSession, setSession } from '@/lib/api'
import { getAdminSession } from '@/lib/adminApi'
import { cn } from '@/components/ui'
import { InstallButton, OfflineBanner, UpdateBanner } from '@/components/pwa'
import { clearApiCache } from '@/lib/pwa'
import LoginPage from './LoginPage'
import NotFound from '../NotFound'

const nav = [
  { to: '', label: 'Buyurtmalar', icon: ClipboardList, end: true },
  { to: 'products', label: 'Mahsulotlar', icon: Package },
  { to: 'stats', label: 'Statistika', icon: BarChart3 },
  { to: 'settings', label: 'Sozlamalar', icon: Settings },
]

export default function DashboardLayout() {
  const { service = '' } = useParams()
  const cfg = getService(service)
  const navigate = useNavigate()
  const [session, setSess] = useState(() => getSession(service))
  const [brand, setBrand] = useState<{ name: string; logo: string; brand: string } | null>(cfg ? { name: cfg.name, logo: cfg.logo, brand: cfg.brand } : null)
  const [notFound, setNotFound] = useState(false)

  // branding from the API (works for markets that are not in config/services.ts)
  useEffect(() => {
    api
      .getMarket(service)
      .then((m) => setBrand({ name: m.name, logo: m.logo || cfg?.logo || '🍽', brand: m.brand || cfg?.brand || '#111827' }))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404 && !cfg) setNotFound(true)
      })
  }, [service, cfg])

  useEffect(() => {
    if (brand) {
      document.documentElement.style.setProperty('--brand', brand.brand)
      document.title = `${brand.name} · Dashboard`
    }
  }, [brand])

  // session sanity check: expired token → back to login
  useEffect(() => {
    if (session) api.me(service).catch(() => {})
  }, [session, service])

  if (notFound) return <NotFound />
  const svc = brand ?? { name: service, logo: '🍽', brand: '#111827' }
  if (!session) return <LoginPage slug={service} name={svc.name} logo={svc.logo} onLogin={(s) => { setSession(service, s); setSess(s) }} />

  const logout = () => {
    setSession(service, null)
    setSess(null)
    clearApiCache()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-full bg-[#f5f5f7]">
      {/* sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col self-start border-r border-gray-200 bg-white md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-2xl">{svc.logo}</div>
          <div className="min-w-0">
            <div className="truncate font-extrabold">{svc.name}</div>
            <div className="text-xs text-gray-500">Dashboard</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold', isActive ? 'bg-brand-soft text-brand' : 'text-gray-600 hover:bg-gray-100')
              }
            >
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-gray-100 p-3">
          <a href={`/markets/${service}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100">
            <ExternalLink size={18} /> Mini app
          </a>
          {getAdminSession() && (
            <button onClick={() => navigate('/admin')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100">
              <ShieldCheck size={18} /> Developer paneli
            </button>
          )}
          <InstallButton />
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100">
            <LogOut size={18} /> Chiqish ({session.name})
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile header */}
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <div className="text-2xl">{svc.logo}</div>
          <div className="font-extrabold">{svc.name}</div>
          <button onClick={logout} className="ml-auto rounded-lg p-2 text-gray-500">
            <LogOut size={18} />
          </button>
        </header>

        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">
          <UpdateBanner />
          <OfflineBanner syncKey={`orders:${service}`} className="mb-3" />
          <Outlet />
        </main>

        {/* mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-white pb-safe md:hidden">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', isActive ? 'text-brand' : 'text-gray-500')}
            >
              <n.icon size={20} /> {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
