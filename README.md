# FastFood Markets — frontend

One React app that hosts many fast-food services. Each service gets:

| URL | What |
|---|---|
| `/markets/<service>` | Customer mini app (opens inside Telegram or any browser) |
| `/dashboard/<service>` | Owner / operator panel |

`<service>` is the slug from `src/config/services.ts` (`totli_dunyo`, `yulduzcha`, `riza_food`, …).
Add a new service = add one entry there. Branding (name, logo, brand colour, bot username) lives in that file; everything else (menu, prices, hours, fees) comes from the backend.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
```

`.env`:

```
VITE_USE_MOCK=false     # true = in-browser mock backend (localStorage), no server needed
VITE_API_URL=           # e.g. https://api.fastfood-markets.uz  (empty = same origin /api → Vite proxies to localhost:8000 in dev)
```

Backend lives in `../backend` (`npm run dev` → http://localhost:8000). Seeded dashboard login: `admin` / `admin` (from backend `.env` `SEED_ADMIN_*`). Mock mode uses the same credentials.

`src/lib/api.ts` exports an `Api` interface implemented by both the real client and the mock, so every endpoint the UI uses has a mock counterpart.

## Customer flow (mini app)

1. Menu — categories, search, "popular" row, add / quantity controls, sticky cart bar.
2. Cart — quantities, delivery fee, free-delivery threshold, minimum order check.
3. Checkout asks:
   - **Ism** (pre-filled from Telegram profile / last order)
   - **Telefon** — "Telegramdan raqamni olish" button (`WebApp.requestContact`) or manual input, validated as `+998XXXXXXXXX`
   - **Yetkazib berish / Olib ketish**
   - **Lokatsiya** — `WebApp.LocationManager` (Bot API 8+) with browser-geolocation fallback; if it fails the user must write **manzil / mo‘ljal** (landmark). If a location was captured the text field becomes optional.
   - **To‘lov turi** — cash / card / Click / Payme (whatever the market enables)
   - **Izoh**
4. Success page with order number + status, "Buyurtmalarim" history (auto-refresh every 15 s).

Extras: market closed banner (working hours), unavailable products greyed out, Telegram back button + haptics, per-market carts persisted in localStorage.

## Dashboard

- **Buyurtmalar** — cards with customer, phone (tap-to-call), Telegram username, address / map link, items, totals. Status flow `new → accepted → preparing → delivering → done` (+ cancel). Polls every 10 s, beeps + browser notification on new orders.
- **Mahsulotlar** — add / edit / delete, toggle *available* and *popular*, size variants, **image upload** (jpeg/png/webp/gif, 5 MB) or emoji.
- **Kategoriyalar** (sheet inside Mahsulotlar) — pick from backend templates (Hot Doglar, Burgerlar, Pitsa…) or type a name; rename, reorder, delete (blocked with a message while products use it).
- **Statistika** — today / 7 days / 30 days revenue, 7-day chart, top products, orders by status.
- **Sozlamalar** — name, phones, address, working hours, accepting-orders switch, delivery fee / min order / free-from, delivery + payment types, **Telegram bot token + group chat ID**, live bot status (configured / polling / @username / mini-app URL) and a "send test message to group" button.
- Expired or invalid dashboard token (401) clears the session and shows the login page.

## Backend contract

All responses JSON. Types are in `src/types.ts` (`Market`, `Product`, `Order`, …).

**Sizes / variants.** A `Product` may carry `variants: [{id, name, price, description?}]` (e.g. hot dog 17/24/28 sm, cocktail kichik/katta, 1 L / 1.5 L). For such products `price` is the lowest variant price and order items must include `variantId`. `OrderItem.name` is the full display name (`"Oddiy Hot Dog — Katta (28 sm)"`). The seeded Totli Dunyo menu in `src/lib/mock.ts` is the reference data set — copy it into your DB.

### Public (mini app)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/markets` | | `Market[]` (landing page) |
| GET | `/api/markets/:slug` | | `Market` |
| GET | `/api/markets/:slug/products` | | `Product[]` |
| POST | `/api/markets/:slug/orders` | `CreateOrderInput` | `Order` (201) |
| GET | `/api/markets/:slug/orders` | `?tg_id=` or `?phone=` | `Order[]` |
| GET | `/api/markets/:slug/orders/:id` | | `Order` |

`CreateOrderInput`:

```json
{
  "items": [{ "productId": "hd_oddiy", "variantId": "katta", "qty": 2 }],
  "customer": { "name": "Jasur", "phone": "+998901234567", "tgId": 123, "tgUsername": "jasur" },
  "deliveryType": "delivery",
  "address": "Chilonzor 19-kvartal, 12-uy",
  "location": { "lat": 41.28, "lng": 69.2 },
  "paymentType": "cash",
  "comment": "piyozsiz",
  "initData": "<Telegram.WebApp.initData — validate with bot token>"
}
```

Backend must: recompute prices from DB (never trust the client), apply delivery fee / free-delivery / min-order rules, assign `number`, save, and **send the Telegram group message** (see below). `Market.isOpen` should already combine the manual switch and working hours.

### Dashboard (Bearer token)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/dashboard/:slug/login` | `{login, password}` | `DashboardSession` |
| GET | `/api/dashboard/:slug/orders` | `?status=active\|new\|accepted\|preparing\|delivering\|done\|cancelled` | `Order[]` |
| PATCH | `/api/dashboard/:slug/orders/:id/status` | `{status}` | `Order` |
| GET | `/api/dashboard/:slug/products` | | `Product[]` |
| POST | `/api/dashboard/:slug/products` | `Product` (no id) | `Product` |
| PUT | `/api/dashboard/:slug/products/:id` | `Product` | `Product` |
| DELETE | `/api/dashboard/:slug/products/:id` | | 204 |
| GET | `/api/dashboard/:slug/me` | | `{marketSlug, role, name}` (token check) |
| GET | `/api/dashboard/:slug/categories` | | `Category[]` |
| GET | `/api/dashboard/:slug/categories/templates` | | `CategoryTemplate[]` |
| POST | `/api/dashboard/:slug/categories` | `{id?, name, sort?}` | `Category` |
| PUT | `/api/dashboard/:slug/categories/:id` | `{name, sort?}` | `Category` |
| DELETE | `/api/dashboard/:slug/categories/:id` | | 204, or 409 with message if products use it |
| POST | `/api/dashboard/:slug/upload` | multipart, field `file` | `{url}` |
| GET | `/api/dashboard/:slug/telegram` | | `TelegramStatus` |
| POST | `/api/dashboard/:slug/telegram/test` | | `{ok, chatId, chatTitle}` |
| GET | `/api/dashboard/:slug/settings` | | `MarketSettings` |
| PUT | `/api/dashboard/:slug/settings` | `MarketSettings` | `MarketSettings` |
| GET | `/api/dashboard/:slug/stats` | | `DashboardStats` |

Errors: non-2xx with `{ "message": "..." }` — the UI shows it as-is.

### Telegram group message

Send to `MarketSettings.telegramGroupId` via `sendMessage` after the order is stored. Suggested text (same as `buildGroupMessage` in `src/lib/mock.ts`):

```
🆕 Yangi buyurtma #1001 — Totli Dunyo

👤 Jasur (@jasur)
📞 +998901234567
🚚 Yetkazib berish
📍 Chilonzor 19-kvartal, 12-uy
🗺 https://maps.google.com/?q=41.28,69.2

• Cheeseburger × 2 = 56 000
• Lavash mini × 1 = 20 000

Yetkazish: 10 000
💰 Jami: 86 000 so'm
💳 To'lov: cash
💬 piyozsiz
```

Tip: attach inline buttons (`✅ Qabul qilish`, `❌ Bekor`) whose callbacks hit the status endpoint, and optionally notify the customer by `tgId` on every status change.

### Telegram setup per service

1. Create a bot in @BotFather, paste its token into Dashboard → Sozlamalar → Bot token, save. The backend starts polling immediately.
2. `/newapp` in @BotFather → Web App URL `https://fastfood-markets.uz/markets/<slug>`.
3. Add the bot to the market's group as admin, put the group chat ID in settings, press "Guruhga sinov xabari".
3. Deploy `dist/` with SPA fallback (all paths → `index.html`), e.g. nginx `try_files $uri /index.html;`.

## Project layout

```
src/
  config/services.ts     service registry (add markets here)
  lib/api.ts             REST client (switches to mock via env)
  lib/mock.ts            localStorage mock backend + group message template
  lib/telegram.ts        WebApp SDK helpers: phone, location, haptics, back button
  store/cart.ts          per-market cart (zustand, persisted)
  pages/market/          menu, cart, checkout, success, my orders
  pages/dashboard/       login, orders, products, stats, settings
```


---

## PWA: qurilmaga o‘rnatish va internetsiz ishlash

Sayt **o‘rnatiladigan ilova** (PWA). Telefonda «Add to Home Screen», kompyuterda Chrome manzil qatoridagi
o‘rnatish belgisi orqali qo‘yiladi; o‘rnatilgach brauzer paneli ko‘rinmaydi va ilova alohida oyna bo‘lib ochiladi.
Kirish sahifasi va panellarda «Ilovani o‘rnatish» tugmasi ham bor — u faqat brauzer o‘rnatishni taklif qilgan
paytda ko‘rinadi (ya‘ni allaqachon o‘rnatilgan bo‘lsa yoki brauzer qo‘llamasa, chiqmaydi).

### Internet yo‘qolganda nima bo‘ladi

YouTube’dagi kabi: oldin ochilgan narsalar ochilaveradi.

| Holat | Xatti-harakat |
|---|---|
| Internet bor | Hamma so‘rov **avval tarmoqqa** boradi — hech narsa sekinlashmaydi, ma’lumot doim yangi |
| Internet yo‘q | Ilova ochiladi, **oxirgi yuklangan** buyurtmalar, mahsulotlar va menyu ko‘rinadi |
| Internet yo‘q, sahifa yangilandi | Ilova baribir ochiladi (app shell keshdan) |
| Internet qaytdi | Keyingi so‘rovda yangi ma’lumot o‘zi keladi |

Servis egasi interneti uzilib qolsa ham panelni ochib, **oxirgi buyurtmalarni ko‘ra oladi**. Yuqorida sariq
chiziq chiqadi: «Internet yo‘q — saqlangan ma’lumotlar ko‘rsatilmoqda (oxirgi yangilanish: …)». Internet
qaytganda chiziq o‘zi yo‘qoladi.

**Nima ishlamaydi (ataylab):** internetsiz holatda buyurtma berish, status o‘zgartirish, mahsulot saqlash —
ya‘ni ma’lumot **o‘zgartiradigan** amallar. Ular oddiy xato beradi, chunki soxta «saqlandi» ko‘rsatish
haqiqiy buyurtmani yo‘qotishdan yomonroq.

### Saytga xalaqit bermasligi uchun

- Barcha `GET` so‘rovlar **network-first**: internet bor paytda kesh umuman ishlatilmaydi.
- `POST`/`PUT`/`PATCH`/`DELETE` service worker’ga umuman kirmaydi.
- Boshqa domenlar (rasmlar `:8000`, Telegram skripti) ushlanmaydi.
- Yangi versiya chiqsa sahifa **o‘zi qayta yuklanmaydi** — yuqorida «Yangilash» tugmasi chiqadi, bosganda yangilanadi.
  Ochiq turgan panel ish orasida uzilmaydi.
- Chiqishda (`Chiqish`) API keshi tozalanadi, shuning uchun keyingi foydalanuvchi avvalgisining buyurtmalarini ko‘rmaydi.
- Dev serverda service worker **ro‘yxatdan o‘tmaydi** (`npm run dev` HMR’ga tegmaydi) — u faqat `npm run build` dan keyin ishlaydi.

### Fayllar

| Fayl | Vazifasi |
|---|---|
| `public/manifest.webmanifest` | ilova nomi, ikonkalar, `display: standalone` |
| `public/sw.js` | service worker: network-first + offline fallback |
| `public/icons/` | 192/512 PNG, maskable, apple-touch-icon, SVG |
| `src/lib/pwa.ts` | ro‘yxatga olish, o‘rnatish taklifi, yangilanish, kesh tozalash |
| `src/lib/offline.ts` | `useOnline()` va oxirgi sinxronlanish vaqti |
| `src/components/pwa.tsx` | `OfflineBanner`, `InstallButton`, `UpdateBanner` |

### Tekshirish

```bash
npm run build && npm run preview
```

Chrome DevTools → **Application** → *Service Workers* (ro‘yxatdan o‘tgan bo‘lishi kerak) va *Manifest*.
Keyin **Network → Offline** ni yoqib, sahifani yangilang: panel ochilib, oxirgi buyurtmalar ko‘rinadi.

> **Diqqat:** prodakshnda PWA **HTTPS** talab qiladi (`localhost` bundan mustasno).
> `https://fastfood-markets.uz` da o‘rnatish va offline rejim o‘zi ishlaydi.
