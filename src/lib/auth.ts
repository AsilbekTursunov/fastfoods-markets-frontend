/**
 * Single sign-in for the whole platform.
 *
 * The backend has two separate login endpoints and no unified one:
 *   POST /api/admin/login            → developer / platform account
 *   POST /api/dashboard/:slug/login  → one service's dashboard account
 *
 * The root gate therefore tries the platform first, then every service in
 * parallel, and routes the user to whichever scope accepted the credentials.
 * See DEVELOPER_PANEL.md for the note about adding one endpoint on the backend.
 */
import type { DashboardSession, PlatformSession } from '@/types'
import { ApiError, api, getSession, setSession } from './api'
import { adminApi, getAdminSession, setAdminSession } from './adminApi'

export type SignInResult =
  | { kind: 'platform'; session: PlatformSession }
  | { kind: 'market'; slug: string; session: DashboardSession }

const DASH_PREFIX = 'ffm:dash:'

/** Dashboard sessions already stored in this browser, newest first is not tracked — order is stable. */
export function findMarketSessions(): { slug: string; session: DashboardSession }[] {
  const out: { slug: string; session: DashboardSession }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(DASH_PREFIX)) continue
    const slug = key.slice(DASH_PREFIX.length)
    const session = getSession(slug)
    if (session) out.push({ slug, session })
  }
  return out
}

export function signOutEverywhere() {
  setAdminSession(null)
  findMarketSessions().forEach(({ slug }) => setSession(slug, null))
}

/** Where an already-signed-in visitor should land when they open the site root. */
export function currentEntryPath(): string | null {
  if (getAdminSession()) return '/admin'
  const markets = findMarketSessions()
  return markets.length ? `/dashboard/${markets[0].slug}` : null
}

export async function signIn(login: string, password: string): Promise<SignInResult> {
  const trimmed = login.trim()

  // 1. platform (developer) account
  try {
    const session = await adminApi.login(trimmed, password)
    setAdminSession(session)
    return { kind: 'platform', session }
  } catch (e) {
    // a blocked account or a server problem must surface as-is, not as "wrong password"
    if (e instanceof ApiError && e.status !== 401 && e.status !== 404) throw e
  }

  // 2. service dashboard account — the slug is unknown, so try every service
  let slugs: string[] = []
  try {
    slugs = (await api.listMarkets()).map((m) => m.slug)
  } catch {
    throw new ApiError(0, 'Server bilan aloqa yo‘q. Keyinroq urinib ko‘ring.')
  }

  const attempts = slugs.map(async (slug) => {
    const session = await api.login(slug, trimmed, password)
    return { slug, session }
  })

  const settled = await Promise.allSettled(attempts)
  const hit = settled.find((r) => r.status === 'fulfilled')
  if (hit && hit.status === 'fulfilled') {
    const { slug, session } = hit.value
    setSession(slug, session)
    return { kind: 'market', slug, session }
  }

  // surface a real problem (blocked account, server down) rather than a generic message
  const meaningful = settled
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => r.reason)
    .find((err) => err instanceof ApiError && err.status !== 401 && err.status !== 404)
  if (meaningful) throw meaningful

  throw new ApiError(401, 'Login yoki parol noto‘g‘ri')
}
