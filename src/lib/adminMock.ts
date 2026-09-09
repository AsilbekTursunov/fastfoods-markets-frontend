/**
 * localStorage-backed developer panel, used when VITE_USE_MOCK=true so the
 * platform login gate keeps working without a backend.
 * Mirrors the rules the real backend enforces (see DEVELOPER_PANEL.md).
 */
import type { PlatformSession, PlatformUser, ServiceAdmin, ServiceSummary } from '@/types'
import { services } from '@/config/services'
import { ApiError } from './api'
import type { AdminApi, CreatePlatformUser, CreateServiceAdmin, UpdatePlatformUser, UpdateServiceAdmin } from './adminApi'

const LS_USERS = 'ffm:mock:platformUsers'
const LS_SADMINS = 'ffm:mock:serviceAdmins'
const LS_PASS = 'ffm:mock:passwords'

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString()

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v))

const seedUsers: PlatformUser[] = [{ id: 1, login: 'admin', name: 'Developer', role: 'admin', active: true, createdAt: now() }]
const seedAdmins: ServiceAdmin[] = Object.keys(services).map((slug, i) => ({
  id: i + 1,
  marketSlug: slug,
  login: slug === 'totli_dunyo' ? 'admin' : `${slug}_admin`,
  name: 'Egasi',
  role: 'owner' as const,
  createdAt: now(),
}))

const getUsers = () => read<PlatformUser[]>(LS_USERS, seedUsers)
const getAdmins = () => read<ServiceAdmin[]>(LS_SADMINS, seedAdmins)
const getPasswords = () => read<Record<string, string>>(LS_PASS, { 'platform:admin': 'admin' })
const setPassword = (key: string, pw: string) => write(LS_PASS, { ...getPasswords(), [key]: pw })
const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((r) => r.id)) + 1

const bad = (msg: string) => new ApiError(400, msg)
const conflict = (msg: string) => new ApiError(409, msg)

function validate(login: string, password?: string) {
  if (login.length < 3) throw bad('Login kamida 3 belgi')
  if (!/^[a-z0-9._-]+$/i.test(login)) throw bad('Loginda faqat harf, raqam va . _ - bo‘lsin')
  if (password !== undefined && password.length < 4) throw bad('Parol kamida 4 belgi')
}

function currentUser(): PlatformUser {
  try {
    const raw = localStorage.getItem('ffm:admin')
    const s = raw ? (JSON.parse(raw) as PlatformSession) : null
    const u = s && getUsers().find((x) => x.id === s.user.id)
    if (!u) throw new ApiError(401, 'Avtorizatsiya talab qilinadi')
    return u
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(401, 'Avtorizatsiya talab qilinadi')
  }
}

function requireAdmin(): PlatformUser {
  const u = currentUser()
  if (u.role !== 'admin') throw new ApiError(403, 'Faqat admin roli uchun ruxsat')
  return u
}

export const mockAdminApi: AdminApi = {
  async login(login, password) {
    await delay(350)
    const user = getUsers().find((u) => u.login === login)
    if (!user || getPasswords()[`platform:${login}`] !== password) throw new ApiError(401, 'Login yoki parol noto‘g‘ri')
    if (!user.active) throw new ApiError(403, 'Bu hisob o‘chirilgan')
    return { token: `mock-platform-${user.id}-${Date.now()}`, user }
  },

  async me() {
    await delay(100)
    return currentUser()
  },

  async changeMyPassword(password) {
    await delay(200)
    const u = currentUser()
    validate(u.login, password)
    setPassword(`platform:${u.login}`, password)
    return u
  },

  async services(): Promise<ServiceSummary[]> {
    await delay(200)
    const admins = getAdmins()
    return Object.values(services).map((s) => ({
      slug: s.slug,
      name: s.name,
      logo: s.logo,
      brand: s.brand,
      adminCount: admins.filter((a) => a.marketSlug === s.slug).length,
    }))
  },

  async serviceAdmins(slug) {
    await delay(150)
    return getAdmins().filter((a) => a.marketSlug === slug)
  },

  async allServiceAdmins() {
    await delay(150)
    return getAdmins()
  },

  async createServiceAdmin(slug, body: CreateServiceAdmin) {
    await delay(250)
    currentUser()
    validate(body.login, body.password)
    const list = getAdmins()
    if (list.some((a) => a.marketSlug === slug && a.login === body.login)) throw conflict('Bu marketda bunday login bor')
    const row: ServiceAdmin = {
      id: nextId(list),
      marketSlug: slug,
      login: body.login,
      name: body.name,
      role: body.role ?? 'owner',
      createdAt: now(),
    }
    write(LS_SADMINS, [...list, row])
    setPassword(`market:${slug}:${body.login}`, body.password)
    return row
  },

  async updateServiceAdmin(slug, id, body: UpdateServiceAdmin) {
    await delay(250)
    currentUser()
    const list = getAdmins()
    const idx = list.findIndex((a) => a.id === id && a.marketSlug === slug)
    if (idx < 0) throw new ApiError(404, 'Topilmadi')
    if (body.password !== undefined) {
      validate(list[idx].login, body.password)
      setPassword(`market:${slug}:${list[idx].login}`, body.password)
    }
    list[idx] = { ...list[idx], name: body.name ?? list[idx].name, role: body.role ?? list[idx].role }
    write(LS_SADMINS, list)
    return list[idx]
  },

  async deleteServiceAdmin(slug, id) {
    await delay(200)
    currentUser()
    const list = getAdmins()
    if (list.filter((a) => a.marketSlug === slug).length <= 1) throw bad('Bu marketning oxirgi admini — avval yangisini qo‘shing')
    write(LS_SADMINS, list.filter((a) => a.id !== id))
  },

  async users() {
    await delay(150)
    requireAdmin()
    return getUsers()
  },

  async createUser(body: CreatePlatformUser) {
    await delay(250)
    requireAdmin()
    validate(body.login, body.password)
    const list = getUsers()
    if (list.some((u) => u.login === body.login)) throw conflict('Bu login band')
    const row: PlatformUser = { id: nextId(list), login: body.login, name: body.name, role: body.role ?? 'manager', active: true, createdAt: now() }
    write(LS_USERS, [...list, row])
    setPassword(`platform:${body.login}`, body.password)
    return row
  },

  async updateUser(id, body: UpdatePlatformUser) {
    await delay(250)
    const me = requireAdmin()
    const list = getUsers()
    const idx = list.findIndex((u) => u.id === id)
    if (idx < 0) throw new ApiError(404, 'Topilmadi')
    const next = { ...list[idx], name: body.name ?? list[idx].name, role: body.role ?? list[idx].role, active: body.active ?? list[idx].active }
    if (id === me.id && (next.role !== 'admin' || !next.active)) throw bad('O‘z hisobingizni o‘chira olmaysiz')
    const activeAdmins = list.filter((u, i) => i !== idx && u.active && u.role === 'admin').length
    if (!activeAdmins && (next.role !== 'admin' || !next.active)) throw bad('Kamida bitta faol admin qolishi kerak')
    if (body.password !== undefined) {
      validate(next.login, body.password)
      setPassword(`platform:${next.login}`, body.password)
    }
    list[idx] = next
    write(LS_USERS, list)
    return next
  },

  async deleteUser(id) {
    await delay(200)
    const me = requireAdmin()
    if (id === me.id) throw bad('O‘z hisobingizni o‘chira olmaysiz')
    const list = getUsers()
    if (!list.filter((u) => u.id !== id && u.active && u.role === 'admin').length) throw bad('Kamida bitta faol admin qolishi kerak')
    write(LS_USERS, list.filter((u) => u.id !== id))
  },
}
