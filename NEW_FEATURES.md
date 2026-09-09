# Yangi imkoniyatlar: reklama xabari + egasining chat ID si

Bu hujjat ikki qismdan iborat:

1. **Frontendda nima qilindi** — tayyor, ishlayapti (mock rejimda to‘liq, real backendda endpoint kutilmoqda).
2. **Backendda nima qilish kerak** — SQL, endpoint, kod. Shu qismni bajarsangiz, hamma narsa ulanadi.

---

## 1. Frontendda nima qilindi

### 1.1 Egasi (owner) chat ID

Dashboard → **Sozlamalar → Telegram** bo‘limida endi ikkita maydon bor:

| Maydon | `MarketSettings` kaliti | Vazifasi |
|---|---|---|
| Guruh chat ID | `telegramGroupId` | buyurtmalar guruhga (bor edi) |
| **Egasi (owner) chat ID** | **`telegramOwnerId`** | **har bir buyurtma egasining shaxsiy chatiga ham** |

Frontend uni `PUT /api/dashboard/:slug/settings` ichida boshqa maydonlar bilan birga yuboradi.

> **Hozircha:** backend `settingsSchema` da bu maydon yo‘q. Zod strict emas, shuning uchun **xato bermaydi** —
> notanish kalitni jimgina tashlab yuboradi. Ya‘ni saqlash ishlaydi, lekin qiymat bazaga yozilmaydi.
> 2.1-bo‘limni bajarganingizdan keyin o‘zi ishlab ketadi, frontendda hech narsa o‘zgartirish shart emas.

### 1.2 Mini app reklama xabari

Yangi bo‘lim: **Sozlamalar → Mini app reklama xabari**. Rasmda ko‘rsatgan xabar shakli:
tepada matn, pastida butun kenglikdagi tugma, tugma bosilsa mini app ochiladi.

Nima bor:

- **Xabar matni** — sukut bo‘yicha: `Barcha mahsulotlarni shu yerdan ko'ring va ZAKAZ BERING!`
- **Tugma matni** — sukut bo‘yicha: `Zakaz Berish`
- **Qayerga** — Guruhga / Egasiga / Ikkalasiga
- **Pin** — xabarni chatga qadab qo‘yish
- **Jonli ko‘rinish (preview)** — yuborishdan oldin qanday chiqishini ko‘rsatadi
- **«Xabarni yuborish»** tugmasi

Matn va tugma matni `MarketSettings` ga saqlanadi (`promoText`, `promoButtonText`), yuborish esa
alohida endpointga so‘rov yuboradi.

> Backend endpointi hali yo‘q bo‘lgani uchun tugma bosilsa frontend 404 ni tushunadi va
> «Backendda /telegram/promo endpointi hali yo‘q» deb yozadi — ilova buzilmaydi.

### 1.3 O‘zgargan fayllar

| Fayl | Nima o‘zgardi |
|---|---|
| `src/types.ts` | `telegramOwnerId`, `promoText`, `promoButtonText`, `PromoTarget`, `PromoInput`, `PromoResult`, `PromoSentTo` |
| `src/lib/api.ts` | `Api` interfeysiga `sendPromo`, real klientda `POST /dashboard/:slug/telegram/promo` |
| `src/lib/mock.ts` | `sendPromo` mock, sukutdagi matnlar (`DEFAULT_PROMO_TEXT`, `DEFAULT_PROMO_BUTTON`), buyurtma logi endi owner chatni ham ko‘rsatadi |
| `src/pages/dashboard/SettingsPage.tsx` | owner chat ID maydoni, reklama bo‘limi, preview, yuborish tugmasi |

---

## 2. Backendda nima qilish kerak

### 2.1 Baza: markets jadvaliga 3 ta ustun

`db/schema.sql` dagi `markets` jadvaliga qo‘shing (mavjud bazaga migratsiya sifatida ham ishlaydi):

```sql
ALTER TABLE markets ADD COLUMN IF NOT EXISTS telegram_owner_id   text;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS promo_text          text;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS promo_button_text   text;
```

`schema.sql` ning o‘zida esa `telegram_group_id` yoniga qo‘shib qo‘ying:

```sql
  telegram_owner_id     text,                                                 -- Egasining shaxsiy chati (buyurtmalar dublikati)
  promo_text            text,                                                 -- Mini app reklama xabari matni
  promo_button_text     text,                                                 -- Reklama tugmasi matni
```

### 2.2 `src/types.ts` — `MarketSettings`

```ts
  telegramGroupId?: string
  telegramOwnerId?: string     // yangi
  promoText?: string           // yangi
  promoButtonText?: string     // yangi
```

### 2.3 `src/services/markets.ts`

**`toSettings`** ga qo‘shing:

```ts
    telegramOwnerId: m.telegram_owner_id ?? '',
    promoText: m.promo_text ?? '',
    promoButtonText: m.promo_button_text ?? '',
```

**`settingsSchema`** ga qo‘shing:

```ts
  telegramOwnerId: optStr,
  promoText: z.string().max(4000).optional().nullable(),
  promoButtonText: z.string().max(40).optional().nullable(),
```

**`updateSettings`** UPDATE so‘roviga uchta ustunni qo‘shing. Diqqat: `telegram_bot_token` da bo‘lgani kabi
bu maydonlarni ham `COALESCE` siz yozing, chunki frontend har doim to‘liq obyekt yuboradi:

```sql
       telegram_owner_id = $19,
       promo_text        = $20,
       promo_button_text = $21
```

```ts
      strOrNull(s.telegramOwnerId),
      strOrNull(s.promoText),
      strOrNull(s.promoButtonText),
```

`MarketRow` tipiga `telegram_owner_id`, `promo_text`, `promo_button_text` ustunlarini qo‘shishni unutmang.

### 2.4 Buyurtmalarni egasiga ham yuborish

`src/telegram/notify.ts` → `notifyNewOrder`. Hozir faqat `telegram_group_id` ga yuboradi.
Guruhga yuborilgan xabar ID si bazaga yoziladi (tugmalarni keyin tahrirlash uchun) — **owner nusxasi uchun buni saqlamang**,
aks holda status o‘zgarganda qaysi xabarni tahrirlashda chalkashlik bo‘ladi.

```ts
export async function notifyNewOrder(market: MarketRow, order: OrderRecord): Promise<void> {
  const token = botTokenFor(market)
  if (!token) { /* ...bor kod... */ return }

  const groupId = market.telegram_group_id?.trim()
  if (groupId) {
    const msg = await bot.sendMessage(token, groupId, buildGroupMessage(order, market.name), { reply_markup: statusKeyboard(order) })
    await setOrderTelegramMessage(order.id, String(msg.chat.id), msg.message_id)
  }

  // YANGI: egasining shaxsiy chatiga nusxa (tugmalarsiz, xabar ID si saqlanmaydi)
  const ownerId = market.telegram_owner_id?.trim()
  if (ownerId && ownerId !== groupId) {
    try {
      await bot.sendMessage(token, ownerId, buildGroupMessage(order, market.name))
    } catch (e) {
      // 403 = egasi botga /start bosmagan; buyurtmani buzmaslik kerak
      if (!(e instanceof TelegramError && (e.code === 403 || e.code === 400))) throw e
      console.info(`[tg] ${market.slug}: owner ${ownerId} ga yuborilmadi (botga /start bosilmagan?)`)
    }
  }

  await tellCustomer(token, market, order)
}
```

> **Muhim:** owner ga yuborish xato bersa ham buyurtma yaratilishi buzilmasligi kerak. Yuqoridagi `try/catch` shuning uchun.

### 2.5 Yangi endpoint: `POST /api/dashboard/:slug/telegram/promo`

`src/routes/dashboard.ts` ga, `telegram/test` yoniga:

```ts
const promoSchema = z.object({
  text: z.string().trim().min(1, 'Matn bo‘sh bo‘lmasin').max(4000),
  buttonText: z.string().trim().min(1).max(40),
  target: z.enum(['group', 'owner', 'both']),
  pin: z.boolean().optional(),
})

/** Send the "open mini app" message with an inline web-app button */
r.post('/:slug/telegram/promo', async (req, res) => {
  const m = await market(req)
  const input = parse(promoSchema, req.body)
  const token = botTokenFor(m)
  if (!token) throw badRequest('Bot token kiritilmagan')

  const appUrl = `${config.publicAppUrl}/markets/${m.slug}`
  // Telegram web_app tugmalari faqat HTTPS da ishlaydi; aks holda oddiy havola tugmasi
  const button = appUrl.startsWith('https://')
    ? { text: input.buttonText, web_app: { url: appUrl } }
    : { text: input.buttonText, url: appUrl }

  const targets: { chat: 'group' | 'owner'; chatId?: string | null }[] = []
  if (input.target !== 'owner') targets.push({ chat: 'group', chatId: m.telegram_group_id })
  if (input.target !== 'group') targets.push({ chat: 'owner', chatId: m.telegram_owner_id })
  const usable = targets.filter((t) => t.chatId?.trim())
  if (!usable.length) throw badRequest('Chat ID kiritilmagan')

  const sent = []
  for (const t of usable) {
    const msg = await bot.sendMessage(token, t.chatId!.trim(), input.text, {
      reply_markup: { inline_keyboard: [[button]] },
    })
    if (input.pin) {
      // pin qila olmasa (admin emas) — xato bermasin
      await bot.pinChatMessage(token, msg.chat.id, msg.message_id).catch(() => {})
    }
    sent.push({ chat: t.chat, chatId: String(msg.chat.id), messageId: msg.message_id, chatTitle: msg.chat.title ?? null })
  }
  res.json({ sent })
})
```

`src/telegram/api.ts` ga bitta metod qo‘shish kerak:

```ts
  pinChatMessage: (token: string, chat_id: number | string, message_id: number) =>
    tgCall(token, 'pinChatMessage', { chat_id, message_id, disable_notification: true }),
```

**So‘rov / javob shakli** (frontend aynan shuni kutadi):

```jsonc
// POST /api/dashboard/totli_dunyo/telegram/promo
{
  "text": "Barcha mahsulotlarni shu yerdan ko'ring va ZAKAZ BERING!",
  "buttonText": "Zakaz Berish",
  "target": "group",          // group | owner | both
  "pin": true
}

// 200 OK
{
  "sent": [
    { "chat": "group", "chatId": "-1001234567890", "messageId": 42, "chatTitle": "Totli Dunyo buyurtmalar" }
  ]
}
```

Xatolar: `400` + `{ "message": "Bot token kiritilmagan" }` ko‘rinishida — frontend `message` ni to‘g‘ridan-to‘g‘ri ko‘rsatadi.

### 2.6 `web_app` tugmasi haqida

Telegram `web_app` tugmasini **faqat HTTPS** URL bilan qabul qiladi. `PUBLIC_APP_URL` hozir
`http://localhost:5173` — shuning uchun yuqoridagi kod avtomatik ravishda oddiy `url` tugmasiga tushadi
(tugma baribir ishlaydi, lekin brauzerda ochiladi, mini app sifatida emas).

Prodakshnda `.env` da:

```
PUBLIC_APP_URL=https://fastfood-markets.uz
```

Shundan keyin tugma haqiqiy mini app tugmasiga aylanadi. Frontend buni allaqachon biladi:
`GET /telegram` javobidagi `webAppButtonsEnabled` false bo‘lsa, sozlamalarda ogohlantirish chiqadi.

---

## 3. Tekshirish tartibi

### 3.0 Avval migratsiyani qo‘llang (eng ko‘p uchraydigan xato)

Kodga ustun qo‘shish yetarli emas — bazada ham ustun bo‘lishi kerak. Aks holda sozlamalarni saqlashda
**500 «Server xatosi»** chiqadi, backend logida esa:

```
error: column "telegram_owner_id" of relation "markets" does not exist
```

Tuzatish (ma’lumotlar o‘chmaydi: `schema.sql` da `ADD COLUMN IF NOT EXISTS`, seed esa `ON CONFLICT DO NOTHING`):

```bash
cd backend && npm run db:setup
```

`tsx watch` kodni o‘zi qayta yuklaydi, lekin bazani o‘zgartirmaydi — shuning uchun bu qadam qo‘lda bajariladi.

### 3.1 Keyin

```bash
cd backend && npm run dev
```

1. Dashboard → Sozlamalar → **Bot token** va **Guruh chat ID** ni kiriting, **Saqlash**.
2. **Guruhga sinov xabari** — guruhga xabar kelsa, bot to‘g‘ri ulangan.
3. **Egasi chat ID** ni kiriting (o‘zingizning Telegram ID ingiz, @userinfobot dan), **Saqlash**.
   Botga bir marta `/start` bosing, aks holda Telegram shaxsiy xabarni bloklaydi.
4. Mini app orqali sinov buyurtmasi bering — xabar **guruhga ham, sizga ham** kelishi kerak.
5. Sozlamalar → **Mini app reklama xabari** → **Xabarni yuborish**. Guruhda matn va tagida
   **ZAKAZ BERISH** tugmasi chiqadi.

---

## 4. Qisqacha xulosa (backend agenti uchun)

| # | Ish | Fayl |
|---|---|---|
| 1 | 3 ta ustun qo‘shish | `db/schema.sql` + migratsiya |
| 2 | `MarketRow`, `MarketSettings` tiplariga maydon qo‘shish | `src/types.ts`, `src/services/markets.ts` |
| 3 | `toSettings` / `settingsSchema` / `updateSettings` | `src/services/markets.ts` |
| 4 | Buyurtmani owner chatiga ham yuborish | `src/telegram/notify.ts` |
| 5 | `pinChatMessage` metodi | `src/telegram/api.ts` |
| 6 | `POST /:slug/telegram/promo` | `src/routes/dashboard.ts` |
| 7 | Prodakshnda `PUBLIC_APP_URL` ni HTTPS qilish | `.env` |

Frontendda **hech narsa o‘zgartirish kerak emas** — hammasi shu shakl ostida yozilgan.
