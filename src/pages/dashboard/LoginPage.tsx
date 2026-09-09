import { useState, type FormEvent } from 'react'
import { api, isMock } from '@/lib/api'
import { Button, Input } from '@/components/ui'
import type { DashboardSession } from '@/types'

export default function LoginPage({ slug, name, logo, onLogin }: { slug: string; name: string; logo: string; onLogin: (s: DashboardSession) => void }) {
  const [login, setLogin] = useState(isMock ? 'admin' : '')
  const [password, setPassword] = useState(isMock ? 'admin' : '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      onLogin(await api.login(slug, login, password))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[#f5f5f7] p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-4xl">{/^https?:/.test(logo) ? <img src={logo} alt="" className="h-full w-full rounded-2xl object-cover" /> : logo}</div>
          <h1 className="mt-3 text-xl font-extrabold">{name}</h1>
          <p className="text-sm text-gray-500">Boshqaruv paneli</p>
        </div>
        <Input label="Login" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
        <Input label="Parol" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Button type="submit" full size="lg" loading={loading}>
          Kirish
        </Button>
        {isMock && <p className="text-center text-xs text-gray-400">Mock rejim: admin / admin</p>}
      </form>
    </div>
  )
}
