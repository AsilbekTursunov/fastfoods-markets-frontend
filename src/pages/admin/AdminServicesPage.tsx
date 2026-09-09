import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Users, ExternalLink, LayoutDashboard, Plus, Pencil, Trash2, KeyRound } from 'lucide-react'
import { Button, Input, Sheet, Spinner, Badge, cn } from '@/components/ui'
import { adminApi, suggestPassword } from '@/lib/adminApi'
import { formatDateTime } from '@/lib/format'
import CredentialsBox from './CredentialsBox'
import type { ServiceAdmin, ServiceAdminRole, ServiceSummary } from '@/types'

export default function AdminServicesPage() {
  const [servicesList, setServicesList] = useState<ServiceSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<ServiceSummary | null>(null)

  const load = useCallback(async () => {
    try {
      setServicesList(await adminApi.services())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
  if (!servicesList) return <Spinner />

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold">Servislar</h1>
        <p className="text-sm text-gray-500">Har bir servis va uning dashboard hisoblari.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {servicesList.map((s) => (
          <div key={s.slug} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-2xl"
                style={{ background: `color-mix(in srgb, ${s.brand || '#111827'} 12%, white)` }}
              >
                {s.logo && /^https?:/.test(s.logo) ? <img src={s.logo} alt="" className="h-full w-full object-cover" /> : s.logo || '🍽'}
              </div>
              <div className="min-w-0">
                <div className="truncate font-bold">{s.name}</div>
                <div className="truncate font-mono text-xs text-gray-400">{s.slug}</div>
              </div>
            </div>

            <button
              onClick={() => setOpen(s)}
              className="mt-3 flex w-full items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              <span className="inline-flex items-center gap-2">
                <Users size={15} /> Adminlar
              </span>
              <Badge color={s.adminCount ? 'gray' : 'red'}>{s.adminCount}</Badge>
            </button>

            <div className="mt-2 flex gap-2 text-sm font-semibold">
              <Link to={`/dashboard/${s.slug}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-white">
                <LayoutDashboard size={15} /> Dashboard
              </Link>
              <a
                href={`/markets/${s.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-gray-700"
              >
                <ExternalLink size={15} /> Mini app
              </a>
            </div>
          </div>
        ))}
      </div>

      <ServiceAdminsSheet service={open} onClose={() => setOpen(null)} onChanged={load} />
    </div>
  )
}

export const ROLE_LABEL: Record<ServiceAdminRole, string> = { owner: 'Egasi', staff: 'Xodim' }

function ServiceAdminsSheet({ service, onClose, onChanged }: { service: ServiceSummary | null; onClose: () => void; onChanged: () => void }) {
  const [admins, setAdmins] = useState<ServiceAdmin[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'edit'; admin: ServiceAdmin } | { mode: 'password'; admin: ServiceAdmin } | null>(null)
  const [created, setCreated] = useState<{ login: string; password: string } | null>(null)

  const slug = service?.slug

  const load = useCallback(async () => {
    if (!slug) return
    setError(null)
    try {
      setAdmins(await adminApi.serviceAdmins(slug))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik')
    }
  }, [slug])

  useEffect(() => {
    if (service) {
      setAdmins(null)
      setForm(null)
      setCreated(null)
      load()
    }
  }, [service, load])

  const remove = async (a: ServiceAdmin) => {
    if (!slug || !confirm(`"${a.login}" hisobi o‘chirilsinmi?`)) return
    setBusy(a.id)
    setError(null)
    try {
      await adminApi.deleteServiceAdmin(slug, a.id)
      await load()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={!!service} onClose={onClose} title={service ? `${service.name} — adminlar` : ''}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pb-3">
        {created && <CredentialsBox login={created.login} password={created.password} where={`/dashboard/${slug}`} />}
        {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {admins === null ? (
          <Spinner className="py-8" />
        ) : admins.length === 0 ? (
          <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-800">
            Bu servisda hisob yo‘q — egasi dashboardga kira olmaydi. Quyidan qo‘shing.
          </div>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.name}</span>
                      <Badge color={a.role === 'owner' ? 'brand' : 'gray'}>{ROLE_LABEL[a.role]}</Badge>
                    </div>
                    <div className="font-mono text-xs text-gray-500">{a.login}</div>
                    <div className="text-xs text-gray-400">{formatDateTime(a.createdAt)}</div>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button onClick={() => setForm({ mode: 'edit', admin: a })} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title="Tahrirlash">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setForm({ mode: 'password', admin: a })} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title="Parol">
                      <KeyRound size={15} />
                    </button>
                    <button
                      onClick={() => remove(a)}
                      disabled={busy === a.id}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50"
                      title="O‘chirish"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {form ? (
          <AdminForm
            slug={slug!}
            form={form}
            onCancel={() => setForm(null)}
            onSaved={async (credentials) => {
              setForm(null)
              setCreated(credentials)
              await load()
              onChanged()
            }}
          />
        ) : (
          <Button variant="secondary" full onClick={() => { setForm({ mode: 'create' }); setCreated(null) }}>
            <Plus size={16} /> Admin qo‘shish
          </Button>
        )}
      </div>
    </Sheet>
  )
}

function AdminForm({
  slug,
  form,
  onCancel,
  onSaved,
}: {
  slug: string
  form: { mode: 'create' } | { mode: 'edit'; admin: ServiceAdmin } | { mode: 'password'; admin: ServiceAdmin }
  onCancel: () => void
  onSaved: (created: { login: string; password: string } | null) => void
}) {
  const existing = form.mode === 'create' ? null : form.admin
  const [login, setLogin] = useState('')
  const [name, setName] = useState(existing?.name ?? '')
  const [role, setRole] = useState<ServiceAdminRole>(existing?.role ?? 'owner')
  const [password, setPassword] = useState(form.mode === 'create' ? suggestPassword() : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (form.mode === 'create') {
        await adminApi.createServiceAdmin(slug, { login: login.trim(), password, name: name.trim() || login.trim(), role })
        onSaved({ login: login.trim(), password })
      } else if (form.mode === 'edit') {
        await adminApi.updateServiceAdmin(slug, form.admin.id, { name: name.trim(), role })
        onSaved(null)
      } else {
        await adminApi.updateServiceAdmin(slug, form.admin.id, { password })
        onSaved({ login: form.admin.login, password })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setBusy(false)
    }
  }

  const title = form.mode === 'create' ? 'Yangi admin' : form.mode === 'edit' ? `${form.admin.login} — tahrirlash` : `${form.admin.login} — yangi parol`

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="text-sm font-bold">{title}</div>

      {form.mode === 'create' && (
        <Input label="Login" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="kassir1" spellCheck={false} autoComplete="off" required hint="Kamida 3 belgi: harf, raqam va . _ -" />
      )}

      {form.mode !== 'password' && (
        <>
          <Input label="Ism" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ism familiya" />
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Rol</span>
            <div className="flex gap-2">
              {(['owner', 'staff'] as ServiceAdminRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn('flex-1 rounded-xl border px-3 py-2 text-sm font-semibold', role === r ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700')}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {form.mode !== 'edit' && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Parol" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" spellCheck={false} required />
          </div>
          <Button type="button" variant="ghost" onClick={() => setPassword(suggestPassword())}>
            Tasodifiy
          </Button>
        </div>
      )}

      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex gap-2">
        <Button type="submit" loading={busy} className="flex-1">
          Saqlash
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Bekor
        </Button>
      </div>
    </form>
  )
}
