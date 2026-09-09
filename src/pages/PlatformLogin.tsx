import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { isMock } from '@/lib/api'
import { currentEntryPath, signIn } from '@/lib/auth'
import { InstallButton } from '@/components/pwa'

/**
 * The site root. Everyone signs in here:
 * a developer lands on /admin, a service owner on their own dashboard.
 * Customer mini apps at /markets/<slug> stay public.
 */
export default function PlatformLogin() {
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // already signed in → straight to the right place
  useEffect(() => {
    document.documentElement.style.setProperty('--brand', '#111827')
    document.title = 'FastFood Markets'
    const path = currentEntryPath()
    if (path) navigate(path, { replace: true })
  }, [navigate])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!login.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      const r = await signIn(login, password)
      navigate(r.kind === 'platform' ? '/admin' : `/dashboard/${r.slug}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kirishda xatolik')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[#f5f5f7] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900 text-3xl">🍔</div>
          <h1 className="mt-3 text-2xl font-extrabold">FastFood Markets</h1>
          <p className="text-sm text-gray-500">Platformaga kirish</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
          <Input label="Login" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus spellCheck={false} />
          <div className="relative">
            <Input
              label="Parol"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-8 text-gray-400" aria-label="Parolni ko‘rsatish">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <Button type="submit" full size="lg" loading={loading} disabled={!login.trim() || !password}>
            <LogIn size={18} /> Kirish
          </Button>

          <p className="text-center text-xs text-gray-400">
            Servis egasi ham, developer ham shu yerdan kiradi. Hisobingiz qaysi darajada bo‘lsa, o‘sha panel ochiladi.
          </p>
          {isMock && <p className="text-center text-xs text-gray-400">Mock rejim: admin / admin</p>}
        </form>

        <div className="mt-4 text-center">
          <InstallButton variant="link" />
        </div>
      </div>
    </div>
  )
}
