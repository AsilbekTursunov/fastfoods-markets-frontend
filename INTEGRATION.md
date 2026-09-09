# Backend ↔ Frontend ulash holati

**Holat: to'liq ulangan.** Frontend `src/lib/api.ts` dagi `Api` interfeysida 25 ta metod bor,
25 tasining ham backendda mos endpointi bor va test qilingan. Ulash uchun qoladigan ish yo'q.

Oxirgi tekshiruv: 59 ta asosiy + 21 ta reklama/owner testi o'tdi, ikkala loyihada `typecheck` toza.

---

## To'liq xarita

| # | Frontend `Api` metodi | Backend endpointi | Izoh |
|---|---|---|---|
| 1 | `listMarkets` | `GET /api/markets` | Landing sahifa shundan o'qiydi |
| 2 | `getMarket` | `GET /api/markets/:slug` | `isOpen` = qo'lda tugma **va** ish vaqti |
| 3 | `getProducts` | `GET /api/markets/:slug/products` | variantlar bilan |
| 4 | `createOrder` | `POST /api/markets/:slug/orders` | narx serverda qayta hisoblanadi |
| 5 | `getMyOrders` | `GET /api/markets/:slug/orders?tg_id=&phone=` | |
| 6 | `getOrder` | `GET /api/markets/:slug/orders/:id` | market bo'yicha chegaralangan |
| 7 | `login` | `POST /api/dashboard/:slug/login` | JWT, faqat o'sha market |
| 8 | `me` | `GET /api/dashboard/:slug/me` | token hali amal qiladimi |
| 9 | `dashboardOrders` | `GET /api/dashboard/:slug/orders?status=` | |
| 10 | `updateOrderStatus` | `PATCH /api/dashboard/:slug/orders/:id/status` | tugagan buyurtma o'zgarmaydi |
| 11 | `dashboardProducts` | `GET /api/dashboard/:slug/products` | |
| 12 | `upsertProduct` | `POST` / `PUT /api/dashboard/:slug/products` | variantlar, narx = eng arzoni |
| 13 | `deleteProduct` | `DELETE /api/dashboard/:slug/products/:id` | |
| 14 | `categories` | `GET /api/dashboard/:slug/categories` | |
| 15 | `categoryTemplates` | `GET /api/dashboard/:slug/categories/templates` | 17 ta tayyor kategoriya |
| 16 | `createCategory` | `POST /api/dashboard/:slug/categories` | dublikat → 409 |
| 17 | `updateCategory` | `PUT /api/dashboard/:slug/categories/:id` | |
| 18 | `deleteCategory` | `DELETE /api/dashboard/:slug/categories/:id` | mahsulot ishlatsa → 409 |
| 19 | `uploadImage` | `POST /api/dashboard/:slug/upload` | multipart, ≤5 MB, jpeg/png/webp/gif |
| 20 | `getSettings` | `GET /api/dashboard/:slug/settings` | |
| 21 | `updateSettings` | `PUT /api/dashboard/:slug/settings` | owner ID va reklama matni ham |
| 22 | `telegramStatus` | `GET /api/dashboard/:slug/telegram` | bot ulanganmi, polling ishlayaptimi |
| 23 | `telegramTest` | `POST /api/dashboard/:slug/telegram/test` | guruhga sinov xabari |
| 24 | `sendPromo` | `POST /api/dashboard/:slug/telegram/promo` | mini app reklama xabari |
| 25 | `stats` | `GET /api/dashboard/:slug/stats` | bugun / 7 kun / 30 kun |

---

## Ishga tushirish

`.env` da baza `PGPORT=5435`, `PGDATABASE=fastfood_service`. Agar hali yaratilmagan bo'lsa:

```bash
npm run db:setup
```

Bu buyruq mavjud bazada ham xavfsiz: `db/schema.sql` idempotent va yangi ustunlarni
`ALTER TABLE … ADD COLUMN IF NOT EXISTS` orqali qo'shadi, ma'lumot yo'qolmaydi.

```bash
cd backend && npm run dev        # http://localhost:8000
cd frontend && npm run dev       # http://localhost:5173
```

---

## Eslatmalar

**Bot token.** `.env` da `TELEGRAM_BOT_TOKEN_<SLUG>` yoki dashboard sozlamalaridagi maydon.
Bazadagi qiymat env dan ustun turadi. Oddiy `TELEGRAM_BOT_TOKEN` **ataylab o'qilmaydi** —
boshqa loyihaning tokeni tasodifan ishlatilib ketmasligi uchun.

**HTTPS.** Telegram `web_app` tugmasini faqat https URL bilan qabul qiladi. `PUBLIC_APP_URL`
hozir `http://localhost:5173`, shuning uchun reklama tugmasi oddiy havolaga tushadi — ishlaydi,
lekin brauzerda ochiladi. Prodakshnda `PUBLIC_APP_URL=https://…` qo'ying.

**Sozlamalarni saqlash.** `telegramGroupId`, `telegramOwnerId`, `promoText`, `promoButtonText`
va `telegramBotToken` `COALESCE` siz yoziladi — ya'ni frontend har doim **to'liq** obyektni
yuborishi kerak. `SettingsPage` avval `getSettings()` ni chaqirib, o'shani qaytargani uchun bu shart bajarilyapti.
Faqat `logo` va `brand` `COALESCE` bilan himoyalangan.
