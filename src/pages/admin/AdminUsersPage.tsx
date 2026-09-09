import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, Pencil, Trash2, KeyRound, Ban, CheckCircle2, ShieldCheck, Store } from 'lucide-react'
import { Button, Input, Sheet, Spinner, Badge, cn } from '@/components/ui'
import { adminApi, getAdminSession, suggestPassword } from '@/lib/adminApi'
import { formatDateTime } from '@/lib/format'
import CredentialsBox from './CredentialsBox'
import { ROLE_LABEL } from './AdminServicesPage'
import type { PlatformRole, PlatformUser, ServiceAdmin, ServiceAdminRole, ServiceSummary } from '@/types'

const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = { admin: 'Admin', manager: 'Manager' }

/** One row of the account list: either a service owner/staff or a platform account. */
type Account = { kind: 'service'; admin: ServiceAdmin } | { kind: 'platform'; user: PlatformUser }

const accountKey = (a: Account) => (a.kind === 'service' ? `s${a.admin.id}` : `p${a.user.id}`)

type Filter = 'all' | 'service' | 'platform'
type FormState =
  | { mode: 'create' }
  | { mode: 'edit'; account: Account }
  | { mode: 'password'; account: Account }

export default function AdminUsersPage() {
  const { isAdmin } = useOutletContext<{ isAdmin: boolean }>()
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [serviceAdmins, setServiceAdmins] = useState<ServiceAdmin[]>([])
  const [servicesList, setServicesList] = useState<ServiceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [form, setForm] = useState<FormState | null>(null)
  const [created, setCreated] = useState<{ login: string; password: string; where: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const meId = getAdminSession()?.user.id

  const load = useCallback(async () => {
    setError(null)
    try {
      const [sa, svc, u] = await Promise.all([
        adminApi.allServiceAdmins(),
        adminApi.services(),
        // a manager may not read platform accounts — that is fine, show the rest
        isAdmin ? adminApi.users().catch(() => [] as PlatformUser[]) : Promise.resolve([] as PlatformUser[]),
      ])
      setServiceAdmins(sa)
      setServicesList(svc)
      setUsers(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    load()
  }, [load])

  const serviceName = useCallback(
    (slug: string) => servicesList.find((s) => s.slug === slug)?.name ?? slug,
    [servicesList],
  )

  const accounts: Account[] = useMemo(() => {
    const rows: Account[] = [
      ...serviceAdmins.map((admin) => ({ kind: 'service' as const, admin })),
      ...users.map((user) => ({ kind: 'platform' as const, user })),
    ]
    return rows.filter((a) => (filter === 'all' ? true : a.kind === filter))
  }, [serviceAdmins, users, filter])

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik')
    } finally {
      setBusy(null)
    }
  }

  const remove = (a: Account) => {
    const label = a.kind === 'service' ? a.admin.login : a.user.login
    if (!confirm(`"${label}" hisobi o‘chirilsinmi?`)) return
    act(accountKey(a), () => (a.kind === 'service' ? adminApi.deleteServiceAdmin(a.admin.marketSlug, a.admin.id) : adminApi.deleteUser(a.user.id)))
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Foydalanuvchilar</h1>
          <p className="text-sm text-gray-500">Servis egalari uchun login/parol shu yerda yaratiladi. Ular saytga kirib, o‘z dashboardiga tushadi.</p>
        </div>
        <Button className="ml-auto" onClick={() => { setForm({ mode: 'create' }); setCreated(null) }}>
          <Plus size={16} /> Foydalanuvchi qo‘shish
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['all', `Hammasi (${serviceAdmins.length + users.length})`],
            ['service', `Servis egalari (${serviceAdmins.length})`],
            ...(isAdmin ? ([['platform', `Platforma (${users.length})`]] as [Filter, string][]) : []),
          ] as [Filter, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={cn('rounded-full px-4 py-1.5 text-sm font-semibold', filter === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 shadow-sm')}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {created && (
        <div className="mb-3">
          <CredentialsBox login={created.login} password={created.password} where={created.where} />
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-gray-500 shadow-sm">Hisob yo‘q</div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Foydalanuvchi</th>
                <th className="px-4 py-2">Qayerga kiradi</th>
                <th className="hidden px-4 py-2 sm:table-cell">Rol</th>
                <th className="hidden px-4 py-2 lg:table-cell">Yaratilgan</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const key = accountKey(a)
                const isSelf = a.kind === 'platform' && a.user.id === meId
                const blocked = a.kind === 'platform' && !a.user.active
                return (
                  <tr key={key} className={cn('border-t border-gray-100', blocked && 'opacity-60')}>
                    <td className="px-4 py-2">
                      <div className="font-semibold">
                        {a.kind === 'service' ? a.admin.name : a.user.name}
                        {isSelf && <span className="ml-2 text-xs font-normal text-gray-400">(siz)</span>}
                      </div>
                      <div className="font-mono text-xs text-gray-500">{a.kind === 'service' ? a.admin.login : a.user.login}</div>
                      <div className="mt-1 flex gap-1 sm:hidden">
                        <Badge color={a.kind === 'service' ? (a.admin.role === 'owner' ? 'brand' : 'gray') : a.user.role === 'admin' ? 'purple' : 'gray'}>
                          {a.kind === 'service' ? ROLE_LABEL[a.admin.role] : PLATFORM_ROLE_LABEL[a.user.role]}
                        </Badge>
                        {blocked && <Badge color="red">Bloklangan</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {a.kind === 'service' ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Store size={14} className="shrink-0 text-gray-400" />
                          <span>
                            <span className="font-medium">{serviceName(a.admin.marketSlug)}</span>
                            <span className="block font-mono text-xs text-gray-400">/dashboard/{a.admin.marketSlug}</span>
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          <ShieldCheck size={14} className="shrink-0 text-gray-400" /> Developer paneli
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-2 sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        <Badge color={a.kind === 'service' ? (a.admin.role === 'owner' ? 'brand' : 'gray') : a.user.role === 'admin' ? 'purple' : 'gray'}>
                          {a.kind === 'service' ? ROLE_LABEL[a.admin.role] : PLATFORM_ROLE_LABEL[a.user.role]}
                        </Badge>
                        {blocked && <Badge color="red">Bloklangan</Badge>}
                      </div>
                    </td>
                    <td className="hidden px-4 py-2 text-gray-500 lg:table-cell">
                      {formatDateTime(a.kind === 'service' ? a.admin.createdAt : a.user.createdAt)}
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setForm({ mode: 'edit', account: a })} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title="Tahrirlash">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setForm({ mode: 'password', account: a })} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title="Parolni almashtirish">
                        <KeyRound size={15} />
                      </button>
                      {a.kind === 'platform' && (
                        <button
                          onClick={() => act(key, () => adminApi.updateUser(a.user.id, { active: !a.user.active }))}
                          disabled={busy === key || isSelf}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                          title={a.user.active ? 'Bloklash' : 'Faollashtirish'}
                        >
                          {a.user.active ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                        </button>
                      )}
                      <button
                        onClick={() => remove(a)}
                        disabled={busy === key || isSelf}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-30"
                        title="O‘chirish"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.mode === 'create' ? 'Yangi foydalanuvchi' : form?.mode === 'edit' ? 'Tahrirlash' : 'Yangi parol'}
      >
        {form && (
          <AccountForm
            form={form}
            services={servicesList}
            canCreatePlatform={isAdmin}
            onCancel={() => setForm(null)}
            onSaved={async (c) => {
              setForm(null)
              setCreated(c)
              await load()
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

type AccountKind = 'service' | 'platform'

function AccountForm({
  form,
  services,
  canCreatePlatform,
  onCancel,
  onSaved,
}: {
  form: FormState
  services: ServiceSummary[]
  canCreatePlatform: boolean
  onCancel: () => void
  onSaved: (created: { login: string; password: string; where: string } | null) => void
}) {
  const existing = form.mode === 'create' ? null : form.account
  const [kind, setKind] = useState<AccountKind>(existing?.kind ?? 'service')
  const [slug, setSlug] = useState(existing?.kind === 'service' ? existing.admin.marketSlug : services[0]?.slug ?? '')
  const [login, setLogin] = useState('')
  const [name, setName] = useState(existing ? (existing.kind === 'service' ? existing.admin.name : existing.user.name) : '')
  const [serviceRole, setServiceRole] = useState<ServiceAdminRole>(existing?.kind === 'service' ? existing.admin.role : 'owner')
  const [platformRole, setPlatformRole] = useState<PlatformRole>(existing?.kind === 'platform' ? existing.user.role : 'manager')
  const [password, setPassword] = useState(form.mode === 'create' ? suggestPassword() : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (form.mode === 'create') {
        const trimmed = login.trim()
        if (kind === 'service') {
          await adminApi.createServiceAdmin(slug, { login: trimmed, password, name: name.trim() || trimmed, role: serviceRole })
          onSaved({ login: trimmed, password, where: `/ → /dashboard/${slug}` })
        } else {
          await adminApi.createUser({ login: trimmed, password, name: name.trim() || trimmed, role: platformRole })
          onSaved({ login: trimmed, password, where: '/ → /admin' })
        }
        return
      }

      const account = form.account
      if (form.mode === 'edit') {
        if (account.kind === 'service') await adminApi.updateServiceAdmin(account.admin.marketSlug, account.admin.id, { name: name.trim(), role: serviceRole })
        else await adminApi.updateUser(account.user.id, { name: name.trim(), role: platformRole })
        onSaved(null)
      } else {
        if (account.kind === 'service') {
          await adminApi.updateServiceAdmin(account.admin.marketSlug, account.admin.id, { password })
          onSaved({ login: account.admin.login, password, where: `/ → /dashboard/${account.admin.marketSlug}` })
        } else {
          await adminApi.updateUser(account.user.id, { password })
          onSaved({ login: account.user.login, password, where: '/ → /admin' })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setBusy(false)
    }
  }

  const showRoleFields = form.mode !== 'password'
  const showPassword = form.mode !== 'edit'

  return (
    <form onSubmit={submit} className="space-y-3 pb-3">
      {form.mode === 'create' && canCreatePlatform && (
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">Hisob turi</span>
          <div className="flex gap-2">
            <TypeButton active={kind === 'service'} onClick={() => setKind('service')} icon={<Store size={15} />} label="Servis egasi" />
            <TypeButton active={kind === 'platform'} onClick={() => setKind('platform')} icon={<ShieldCheck size={15} />} label="Developer" />
          </div>
        </div>
      )}

      {kind === 'service' && showRoleFields && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Servis</span>
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={form.mode !== 'create'}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 disabled:bg-gray-50 disabled:text-gray-500"
          >
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.logo} {s.name}
              </option>
            ))}
          </select>
          {form.mode !== 'create' && <span className="mt-1 block text-xs text-gray-400">Servisni almashtirib bo‘lmaydi — yangi hisob yarating.</span>}
        </label>
      )}

      {form.mode === 'create' && (
        <Input
          label="Login"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="masalan: totli_egasi"
          spellCheck={false}
          autoComplete="off"
          required
          hint="Kamida 3 belgi: harf, raqam va . _ -"
        />
      )}

      {showRoleFields && (
        <>
          <Input label="Ism" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ism familiya" />
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Rol</span>
            {kind === 'service' ? (
              <>
                <div className="flex gap-2">
                  {(['owner', 'staff'] as ServiceAdminRole[]).map((r) => (
                    <RoleButton key={r} active={serviceRole === r} onClick={() => setServiceRole(r)} label={ROLE_LABEL[r]} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">Ikkalasi ham o‘z servisining dashboardiga kiradi.</p>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  {(['admin', 'manager'] as PlatformRole[]).map((r) => (
                    <RoleButton key={r} active={platformRole === r} onClick={() => setPlatformRole(r)} label={PLATFORM_ROLE_LABEL[r]} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">Admin — hamma narsa. Manager — faqat servis hisoblarini boshqaradi.</p>
              </>
            )}
          </div>
        </>
      )}

      {showPassword && (
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

function TypeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold',
        active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700',
      )}
    >
      {icon} {label}
    </button>
  )
}

function RoleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex-1 rounded-xl border px-3 py-2 text-sm font-semibold', active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700')}
    >
      {label}
    </button>
  )
}
