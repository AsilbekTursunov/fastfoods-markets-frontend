import { useEffect, useState, type FormEvent } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Store, Users, LogOut, KeyRound } from 'lucide-react'
import { Button, Input, Sheet, cn } from '@/components/ui'
import { InstallButton, OfflineBanner, UpdateBanner } from '@/components/pwa'
import { clearApiCache } from '@/lib/pwa'
import { adminApi, getAdminSession, setAdminSession, suggestPassword } from '@/lib/adminApi'
import type { PlatformUser } from '@/types'

export default function AdminLayout() {
  const navigate = useNavigate()
  const [session, setSess] = useState(() => getAdminSession())
  const [me, setMe] = useState<PlatformUser | null>(session?.user ?? null)
  const [pwOpen, setPwOpen] = useState(false)

  useEffect(() => {
    document.documentElement.style.setProperty('--brand', '#111827')
    document.title = 'Developer paneli'
  }, [])

  // refresh the role from the server: it may have changed since login
  useEffect(() => {
    if (session) adminApi.me().then(setMe).catch(() => {})
  }, [session])

  if (!session) return <Navigate to="/" replace />

  const logout = () => {
    setAdminSession(null)
    setSess(null)
    clearApiCache()
    navigate('/', { replace: true })
  }

  const isAdmin = (me ?? session.user).role === 'admin'

  const nav = [
    { to: '', label: 'Servislar', icon: Store, end: true, show: true },
    // managers may manage service accounts too; the page itself hides platform accounts from them
    { to: 'users', label: 'Foydalanuvchilar', icon: Users, end: false, show: true },
  ].filter((n) => n.show)

  return (
    <div className="flex min-h-full bg-[#f5f5f7]">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col self-start border-r border-gray-200 bg-white md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-2xl">🍔</div>
          <div className="min-w-0">
            <div className="truncate font-extrabold">Developer</div>
            <div className="truncate text-xs text-gray-500">{(me ?? session.user).name}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold', isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')
              }
            >
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-gray-100 p-3">
          <button onClick={() => setPwOpen(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100">
            <KeyRound size={18} /> Parolni almashtirish
          </button>
          <InstallButton />
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100">
            <LogOut size={18} /> Chiqish
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <div className="text-2xl">🍔</div>
          <div className="font-extrabold">Developer</div>
          <button onClick={logout} className="ml-auto rounded-lg p-2 text-gray-500">
            <LogOut size={18} />
          </button>
        </header>

        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">
          <UpdateBanner />
          <OfflineBanner className="mb-3" />
          <Outlet context={{ isAdmin }} />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-white pb-safe md:hidden">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', isActive ? 'text-gray-900' : 'text-gray-500')}
            >
              <n.icon size={20} /> {n.label}
            </NavLink>
          ))}
          <button onClick={() => setPwOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-gray-500">
            <KeyRound size={20} /> Parol
          </button>
        </nav>
      </div>

      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}

function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword('')
      setError(null)
      setDone(false)
    }
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adminApi.changeMyPassword(password)
      setDone(true)
      setTimeout(onClose, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Parolni almashtirish">
      <form onSubmit={submit} className="space-y-3 pb-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Yangi parol" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <Button type="button" variant="ghost" onClick={() => setPassword(suggestPassword())}>
            Tasodifiy
          </Button>
        </div>
        {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {done && <div className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">Parol almashtirildi ✓</div>}
        <Button type="submit" full loading={busy} disabled={password.length < 4}>
          Saqlash
        </Button>
      </form>
    </Sheet>
  )
}
