# Developer paneli — servis admin hisoblarini boshqarish

> **Holat (2026-09-09): frontend qurildi va real backend bilan tekshirildi.**
> Hujjatdagi rejadan bitta farq bor: panel `/admin` da qoldi, lekin **saytga kirish nuqtasi endi `/` (root)**.
> Batafsil — eng oxirdagi «Kirish nuqtasi» bo‘limida.

Backend tayyor va test qilingan. Bu hujjat frontendda nima qurish kerakligini tushuntiradi.

Maqsad: **siz (developer)** har bir servis uchun dashboard hisoblarini yaratasiz, tahrirlaysiz,
parolini almashtirasiz va o'chirasiz. Servis egasi shu login/parol bilan `/dashboard/<slug>` ga kiradi.

---

## Ikkita alohida daraja

| Daraja | Kim | Qayerga kiradi | Token |
|---|---|---|---|
| **Platforma (developer)** | siz va yordamchilaringiz | `/admin` (yangi sahifa) | `scope: platform` |
| **Servis admini** | market egasi, kassir | `/dashboard/<slug>` (mavjud) | `scope: market` |

Tokenlar **aralashmaydi**. Platforma tokeni bilan market paneliga kirsangiz `403`, market tokeni
bilan developer paneliga kirsangiz ham `403`. Buni backend majburlaydi, frontendda tekshirish shart emas.

### Standart hisob

```
login: admin
parol: admin
rol:   admin
```

Bu hisob `npm run db:setup` yoki `npm run mongo:setup` paytida bir marta yaratiladi.
Ishlab chiqarishga chiqishdan oldin parolini almashtiring (`PATCH /api/admin/me/password`).

### Platforma rollari

| Rol | Servis adminlarini boshqarish | Platforma foydalanuvchilarini boshqarish |
|---|---|---|
| `admin` | ha | ha |
| `manager` | ha | yo'q (`403`) |

---

## API

Hammasi `/api/admin/...`. Kirishdan keyin har bir so'rovga `Authorization: Bearer <token>`.
Xatolar boshqa endpointlardagi kabi `{ "message": "..." }` — matnni to'g'ridan-to'g'ri ko'rsatavering, u o'zbekcha.

### Kirish

| Metod | Yo'l | Tana | Javob |
|---|---|---|---|
| POST | `/api/admin/login` | `{login, password}` | `PlatformSession` |
| GET | `/api/admin/me` | | `PlatformUser` |
| PATCH | `/api/admin/me/password` | `{password}` | `PlatformUser` |

```ts
interface PlatformUser {
  id: number
  login: string
  name: string
  role: 'admin' | 'manager'
  active: boolean
  createdAt: string
}
interface PlatformSession { token: string; user: PlatformUser }
```

### Servislar

| Metod | Yo'l | Javob |
|---|---|---|
| GET | `/api/admin/services` | `ServiceSummary[]` |

```ts
interface ServiceSummary {
  slug: string        // totli_dunyo
  name: string        // Totli Dunyo
  logo?: string       // 🍰
  brand?: string      // #e11d48
  adminCount: number  // nechta dashboard hisobi bor
}
```

### Servis admin hisoblari

| Metod | Yo'l | Tana | Javob |
|---|---|---|---|
| GET | `/api/admin/service-admins?service=<slug>` | | `ServiceAdmin[]` (parametrsiz — hammasi) |
| GET | `/api/admin/services/:slug/admins` | | `ServiceAdmin[]` |
| POST | `/api/admin/services/:slug/admins` | `{login, password, name, role?}` | `ServiceAdmin` (201) |
| PUT | `/api/admin/services/:slug/admins/:id` | `{name?, role?, password?}` | `ServiceAdmin` |
| DELETE | `/api/admin/services/:slug/admins/:id` | | 204 |

```ts
interface ServiceAdmin {
  id: number
  marketSlug: string
  login: string
  name: string
  role: 'owner' | 'staff'
  createdAt: string
}
```

`role` sukut bo'yicha `owner`. Parol hech qachon qaytarilmaydi — faqat yozish mumkin.
Loginni tahrirlab bo'lmaydi: kerak bo'lsa eskisini o'chirib, yangisini yarating.

### Platforma foydalanuvchilari (faqat `role: admin`)

| Metod | Yo'l | Tana |
|---|---|---|
| GET | `/api/admin/users` | |
| POST | `/api/admin/users` | `{login, password, name, role?}` (`role` sukut: `manager`) |
| PUT | `/api/admin/users/:id` | `{name?, role?, active?, password?}` |
| DELETE | `/api/admin/users/:id` | |

---

## Backend majburlaydigan qoidalar

Bularni frontendda takrorlash shart emas, lekin xabarni chiroyli ko'rsatish uchun bilib qo'ying:

| Holat | Javob | Xabar |
|---|---|---|
| Login band | 409 | `Bu login band` / `Bu marketda bunday login bor` |
| Login 3 belgidan qisqa yoki `a-z 0-9 . _ -` dan tashqari belgi | 400 | `Login kamida 3 belgi` / `Loginda faqat harf, raqam va . _ - bo'lsin` |
| Parol 4 belgidan qisqa | 400 | `Parol kamida 4 belgi` |
| Marketning **oxirgi** adminini o'chirish | 400 | `Bu marketning oxirgi admini — avval yangisini qo'shing` |
| O'z hisobingizni o'chirish yoki bloklash | 400 | `O'z hisobingizni o'chira olmaysiz` |
| Oxirgi faol adminni manager qilish / bloklash | 400 | `Kamida bitta faol admin qolishi kerak` |
| Nofaol hisob bilan kirish | 403 | `Bu hisob o'chirilgan` |
| `manager` platforma foydalanuvchilariga tegsa | 403 | `Faqat admin roli uchun ruxsat` |

---

## Frontendda nima qurish kerak

### 1. `src/lib/adminApi.ts`

Alohida klient, chunki token boshqa joyda saqlanadi (`ffm:admin` kaliti, market sessiyalari `ffm:dash:<slug>` da).

```ts
import type { PlatformSession, PlatformUser, ServiceAdmin, ServiceSummary } from '@/types'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') + '/api'
const KEY = 'ffm:admin'

export const getAdminSession = (): PlatformSession | null => {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null } catch { return null }
}
export const setAdminSession = (s: PlatformSession | null) =>
  s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY)

async function http<T>(path: string, opts: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as any) }
  if (opts.auth !== false) {
    const s = getAdminSession()
    if (s) headers.Authorization = `Bearer ${s.token}`
  }
  const res = await fetch(BASE + path, { ...opts, headers })
  if (res.status === 401) { setAdminSession(null); location.reload() }
  if (!res.ok) {
    let msg = res.statusText
    try { msg = (await res.json()).message ?? msg } catch {}
    throw new Error(msg)
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>)
}

export const adminApi = {
  login: (login: string, password: string) =>
    http<PlatformSession>('/admin/login', { method: 'POST', body: JSON.stringify({ login, password }), auth: false }),
  me: () => http<PlatformUser>('/admin/me'),
  changeMyPassword: (password: string) =>
    http<PlatformUser>('/admin/me/password', { method: 'PATCH', body: JSON.stringify({ password }) }),

  services: () => http<ServiceSummary[]>('/admin/services'),
  serviceAdmins: (slug: string) => http<ServiceAdmin[]>(`/admin/services/${slug}/admins`),
  createServiceAdmin: (slug: string, b: { login: string; password: string; name: string; role?: 'owner' | 'staff' }) =>
    http<ServiceAdmin>(`/admin/services/${slug}/admins`, { method: 'POST', body: JSON.stringify(b) }),
  updateServiceAdmin: (slug: string, id: number, b: { name?: string; role?: 'owner' | 'staff'; password?: string }) =>
    http<ServiceAdmin>(`/admin/services/${slug}/admins/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteServiceAdmin: (slug: string, id: number) =>
    http<void>(`/admin/services/${slug}/admins/${id}`, { method: 'DELETE' }),

  users: () => http<PlatformUser[]>('/admin/users'),
  createUser: (b: { login: string; password: string; name: string; role?: 'admin' | 'manager' }) =>
    http<PlatformUser>('/admin/users', { method: 'POST', body: JSON.stringify(b) }),
  updateUser: (id: number, b: { name?: string; role?: 'admin' | 'manager'; active?: boolean; password?: string }) =>
    http<PlatformUser>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteUser: (id: number) => http<void>(`/admin/users/${id}`, { method: 'DELETE' }),
}
```

### 2. `src/types.ts` ga qo'shing

```ts
export type PlatformRole = 'admin' | 'manager'

export interface PlatformUser { id: number; login: string; name: string; role: PlatformRole; active: boolean; createdAt: string }
export interface PlatformSession { token: string; user: PlatformUser }
export interface ServiceAdmin { id: number; marketSlug: string; login: string; name: string; role: 'owner' | 'staff'; createdAt: string }
export interface ServiceSummary { slug: string; name: string; logo?: string; brand?: string; adminCount: number }
```

### 3. Marshrutlar (`App.tsx`)

```tsx
<Route path="/admin" element={<AdminLayout />}>
  <Route index element={<AdminServicesPage />} />       {/* servislar va ularning adminlari */}
  <Route path="users" element={<AdminUsersPage />} />   {/* faqat role === 'admin' ga ko'rinadi */}
</Route>
```

`AdminLayout` — `DashboardLayout` ning aynan nusxasi: sessiya bo'lmasa login formasi, bo'lsa yon menyu.

### 4. Sahifalar

**Servislar (asosiy sahifa).** `adminApi.services()` dan kartalar: logotip, nom, `adminCount`.
Kartani bosganda o'sha servisning adminlari jadvali ochiladi (`serviceAdmins(slug)`):
ism, login, rol, yaratilgan sana va har qatorda **Tahrirlash** / **Parolni almashtirish** / **O'chirish**.
Tepada **"+ Admin qo'shish"** tugmasi — modal: login, ism, parol, rol.

Foydali qulaylik: parol maydoni yoniga «tasodifiy parol» tugmasi va yaratilgandan keyin
login/parolni bir marta ko'rsatib, nusxa olish tugmasi qo'ying — parol boshqa hech qachon qaytarilmaydi.

**Foydalanuvchilar.** Faqat `session.user.role === 'admin'` bo'lsa menyuda ko'rsating.
Jadval: ism, login, rol, faol/nofaol. Amallar: yaratish, rolni almashtirish, faolsizlantirish, parol, o'chirish.
`403` kelsa menyudan yashiring — backend baribir himoyalangan.

### 5. Landing sahifaga havola

`Landing.tsx` pastiga kichik «Developer paneli» havolasi (`/admin`) qo'shsangiz kifoya.

---

## Tekshirish

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

1. `/admin` → `admin` / `admin` bilan kiring.
2. Totli Dunyo ga yangi admin qo'shing, masalan `kassir1` / `kassir123`, rol `staff`.
3. Boshqa brauzer oynasida `/dashboard/totli_dunyo` ga o'sha login bilan kiring — kirishi kerak.
4. `/dashboard/riza_food` ga o'sha login bilan kiring — **kirmasligi** kerak.
5. Developer panelida parolni almashtiring, eski parol ishlamasligini tekshiring.
6. Servisning oxirgi adminini o'chirmoqchi bo'ling — backend ruxsat bermaydi.

Backend tomonida bu ssenariylarning barchasi avtomatik test qilingan: 123 ta tekshiruv
MongoDB va PostgreSQL da bir xil natija beradi.


---

## Kirish nuqtasi: root endi login sahifasi

Avval `/` ochiq landing sahifa edi (servislar ro‘yxati hammaga ko‘rinardi). Endi:

| Yo‘l | Kim ko‘radi |
|---|---|
| `/` | **Hamma uchun bitta login forma.** Developer ham, servis egasi ham shu yerdan kiradi |
| `/admin` | Developer paneli (platforma tokeni bo‘lsa) |
| `/dashboard/<slug>` | Servis paneli (market tokeni bo‘lsa; to‘g‘ridan-to‘g‘ri havola uchun o‘z login formasi ham qoldi) |
| `/markets/<slug>` | **Ochiq** — mijozlar mini app’i, login so‘ralmaydi |

Kirgandan keyin:

- rol **platforma** hisobi bo‘lsa → `/admin` (servislar + foydalanuvchilar)
- rol **servis** hisobi bo‘lsa → **o‘zining** `/dashboard/<slug>` iga o‘tadi
- keyingi safar `/` ga kirsa, ochiq sessiyasi qayerga tegishli bo‘lsa, o‘sha yerga o‘zi yo‘naltiradi

### Bitta login forma ikkita endpointga qanday tushadi

Backendda umumiy login yo‘q — ikkita alohida endpoint bor va market endpointi `slug` talab qiladi:

```
POST /api/admin/login              → platforma
POST /api/dashboard/:slug/login    → market (slug kerak!)
```

Root formada slug noma’lum. Shuning uchun `src/lib/auth.ts` shunday ishlaydi:

1. avval `POST /api/admin/login`;
2. u `401` bersa, `GET /api/markets` dan slug ro‘yxatini olib, har biriga
   `POST /api/dashboard/<slug>/login` ni **parallel** yuboradi;
3. qaysi biri qabul qilsa, o‘sha panelga kiritadi;
4. `401`/`404` dan boshqa xato (masalan «Bu hisob o‘chirilgan») bo‘lsa, o‘sha xabar ko‘rsatiladi.

**Kamchiligi:** noto‘g‘ri parolda servislar soniga teng so‘rov ketadi va backend logida
shuncha muvaffaqiyatsiz urinish ko‘rinadi. 3–10 ta servisda muammo emas, lekin o‘nlab servis bo‘lsa yaxshi emas.

### Tavsiya: backendga bitta endpoint qo‘shing

```
POST /api/login   { login, password }
```

Javob — qaysi darajaga tegishli bo‘lsa, o‘shani qaytarsin:

```jsonc
// platforma hisobi
{ "scope": "platform", "token": "...", "user": { "id": 1, "login": "admin", "name": "Developer", "role": "admin", "active": true, "createdAt": "..." } }

// servis hisobi
{ "scope": "market", "marketSlug": "totli_dunyo", "token": "...", "role": "owner", "name": "Kassir" }
```

Bir xil login ikkala jadvalda ham bo‘lsa, platformani ustun qilib oling.
Bu qo‘shilgach `src/lib/auth.ts` dagi `signIn` ni bitta so‘rovga qisqartirish kerak — boshqa joyga tegmaydi.

---

## Hisoblar bitta joyda yaratiladi

**Foydalanuvchilar** sahifasi — barcha hisoblar uchun yagona joy. Jadvalda har bir hisob va uning
**«Qayerga kiradi»** ustuni ko‘rinadi, shuning uchun kim servis egasi, kim developer ekani darrov ma’lum.

«Foydalanuvchi qo‘shish» formasida avval **hisob turi** tanlanadi:

| Turi | Nima bo‘ladi | Rollari |
|---|---|---|
| **Servis egasi** (sukut bo‘yicha) | servis tanlanadi, hisob o‘sha marketga biriktiriladi | Egasi / Xodim |
| **Developer** | platforma hisobi | Admin / Manager |

Yaratilgandan keyin login va parol bir marta ko‘rsatiladi, «Kirish» qatorida esa
`/ → /dashboard/<slug>` deb yoziladi — ya‘ni odam saytning asosiy sahifasidan kiradi va
o‘zining dashboardiga tushadi.

> **Diqqat:** «Developer» turi bilan yaratilgan hisob servis dashboardiga **kirmaydi** — u `/admin` ga tushadi.
> Servis egasi uchun albatta «Servis egasi» turini tanlang.

`manager` roli platforma hisoblarini ko‘rmaydi: unga faqat servis egalari ro‘yxati va
«Servis egasi» turi ko‘rsatiladi.

---

## Frontendda nima qurildi

| Fayl | Vazifasi |
|---|---|
| `src/lib/adminApi.ts` | `/api/admin/...` klienti, `AdminApi` interfeysi, `ffm:admin` sessiyasi, `401` da avtomatik chiqish, `suggestPassword()` |
| `src/lib/adminMock.ts` | `VITE_USE_MOCK=true` uchun to‘liq mock (backend qoidalari bilan birga) — mock rejimda ham login ishlaydi |
| `src/lib/auth.ts` | `signIn()`, `currentEntryPath()`, `findMarketSessions()`, `signOutEverywhere()` |
| `src/pages/PlatformLogin.tsx` | root login sahifasi |
| `src/pages/admin/AdminLayout.tsx` | yon menyu, rolga qarab «Foydalanuvchilar» bo‘limini yashiradi, «Parolni almashtirish» |
| `src/pages/admin/AdminServicesPage.tsx` | servis kartalari + har biriga adminlar CRUD (qo‘shish / tahrirlash / parol / o‘chirish) |
| `src/pages/admin/AdminUsersPage.tsx` | barcha hisoblar bitta jadvalda; qo‘shishda «Servis egasi / Developer» turi tanlanadi; CRUD ikkala tur uchun ham |
| `src/pages/admin/CredentialsBox.tsx` | yangi hisob login/parolini bir marta ko‘rsatadi, nusxa olish tugmasi bilan |

`src/pages/Landing.tsx` o‘chirildi — uning vazifasini `/admin` dagi «Servislar» sahifasi bajaradi.
Servis panelidagi «Chiqish» endi `/` ga qaytaradi; platforma tokeni bo‘lsa yon menyuda «Developer paneli» havolasi chiqadi.

## Tekshirildi (real backend bilan)

| Ssenariy | Natija |
|---|---|
| `/` da noto‘g‘ri parol | «Login yoki parol noto‘g‘ri» |
| `admin` / `admin` | `/admin`, 3 ta servis ko‘rindi |
| Totli Dunyo ga `kassir1` (xodim) qo‘shish | yaratildi, login/parol bir marta ko‘rsatildi |
| `/` da `kassir1` bilan kirish | to‘g‘ridan-to‘g‘ri `/dashboard/totli_dunyo` ga tushdi |
| Qayta `/` ga kirish | ochiq sessiya bo‘yicha o‘zi yo‘naltirdi |
| Platforma foydalanuvchisini yaratish / bloklash / o‘chirish | ishladi |
| O‘z hisobini bloklash / o‘chirish | tugmalar o‘chirilgan |
| `manager` roli bilan kirish | menyuda «Foydalanuvchilar» yo‘q; to‘g‘ridan-to‘g‘ri kirsa «Faqat admin roli uchun ruxsat» |
| `/markets/totli_dunyo` | login so‘ramaydi, ochiq |
| Foydalanuvchilar sahifasidan `totli_egasi` (Servis egasi → Totli Dunyo) yaratish | yaratildi, «Kirish: / → /dashboard/totli_dunyo» ko‘rsatildi |
| `/` da `totli_egasi` bilan kirish | `/dashboard/totli_dunyo` ga tushdi, platforma sessiyasi ochilmadi |
