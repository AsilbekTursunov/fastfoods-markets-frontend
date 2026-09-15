import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { RefreshCw, Send, Eye, EyeOff, Megaphone, ExternalLink, Bike, Plus, Trash2, Navigation, MapPin, X } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { api, ApiError, isMock } from '@/lib/api'
import { requestLocation } from '@/lib/telegram'
import { mapsLink } from '@/lib/format'
import { DEFAULT_PROMO_BUTTON, DEFAULT_PROMO_TEXT } from '@/lib/mock'
import { Button, Input, Spinner, Textarea, cn } from '@/components/ui'
import { DELIVERY_LABEL, PAYMENT_LABEL } from '@/components/status'
import type { Courier, DeliveryType, MarketSettings, Owner, PaymentType, PromoTarget, TelegramStatus } from '@/types'

const ALL_PAYMENTS: PaymentType[] = ['cash', 'card', 'click', 'payme']
const ALL_DELIVERY: DeliveryType[] = ['delivery', 'pickup']

export default function SettingsPage() {
  const { service = '' } = useParams()
  const [s, setS] = useState<MarketSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tg, setTg] = useState<TelegramStatus | null>(null)
  const [locBusy, setLocBusy] = useState(false)
  const [tgBusy, setTgBusy] = useState(false)
  const [tgMsg, setTgMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [promoTarget, setPromoTarget] = useState<PromoTarget>('group')
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoPin, setPromoPin] = useState(true)
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null)
  /** fields the backend does not persist yet (it strips unknown keys silently) */
  const [unsupported, setUnsupported] = useState<string[]>([])

  const loadTg = useCallback(() => api.telegramStatus(service).then(setTg).catch(() => setTg(null)), [service])

  useEffect(() => {
    api.getSettings(service).then(setS).catch((e) => setError(e instanceof Error ? e.message : 'Xatolik'))
    loadTg()
  }, [service, loadTg])

  if (error && !s) return <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
  if (!s) return <Spinner />

  const promoText = s.promoText ?? DEFAULT_PROMO_TEXT
  const promoButtonText = s.promoButtonText || DEFAULT_PROMO_BUTTON

  const owners: Owner[] = s.owners ?? []
  const setOwner = (i: number, patch: Partial<Owner>) => setS({ ...s, owners: owners.map((o, k) => (k === i ? { ...o, ...patch } : o)) })
  const addOwner = () => setS({ ...s, owners: [...owners, { name: '', tgId: '' }] })
  const removeOwner = (i: number) => setS({ ...s, owners: owners.filter((_, k) => k !== i) })

  const couriers: Courier[] = s.couriers ?? []
  const setCourier = (i: number, patch: Partial<Courier>) => setS({ ...s, couriers: couriers.map((c, k) => (k === i ? { ...c, ...patch } : c)) })
  const addCourier = () => setS({ ...s, couriers: [...couriers, { name: '', tgId: '' }] })
  const removeCourier = (i: number) => setS({ ...s, couriers: couriers.filter((_, k) => k !== i) })

  const pickMyLocation = async () => {
    setLocBusy(true)
    const loc = await requestLocation()
    setLocBusy(false)
    if (loc) setS({ ...s, location: { lat: Math.round(loc.lat * 1e6) / 1e6, lng: Math.round(loc.lng * 1e6) / 1e6 } })
    else setError('Joylashuvni olib bo‘lmadi — brauzerga ruxsat bering yoki koordinatalarni qo‘lda kiriting')
  }

  const sendPromo = async () => {
    setPromoBusy(true)
    setPromoMsg(null)
    try {
      const r = await api.sendPromo(service, { text: promoText, buttonText: promoButtonText, target: promoTarget, pin: promoPin })
      const where = r.sent.map((x) => (x.chatTitle ? `"${x.chatTitle}"` : x.chatId)).join(', ')
      setPromoMsg({ ok: true, text: r.sent.length ? `Yuborildi → ${where}` : 'Hech qayerga yuborilmadi' })
    } catch (e) {
      const notReady = e instanceof ApiError && e.status === 404
      setPromoMsg({
        ok: false,
        text: notReady ? 'Backendda /telegram/promo endpointi hali yo‘q (NEW_FEATURES.md ga qarang)' : e instanceof Error ? e.message : 'Xatolik',
      })
    } finally {
      setPromoBusy(false)
    }
  }

  const testTelegram = async () => {
    setTgBusy(true)
    setTgMsg(null)
    try {
      const r = await api.telegramTest(service)
      setTgMsg({ ok: true, text: `Xabar yuborildi${r.chatTitle ? ` → "${r.chatTitle}"` : ''}` })
    } catch (e) {
      setTgMsg({ ok: false, text: e instanceof Error ? e.message : 'Xatolik' })
    } finally {
      setTgBusy(false)
      loadTg()
    }
  }

  const toggleIn = <T extends string>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      // send the full object: backend overwrites telegramBotToken with whatever we send
      const cleaned: MarketSettings = {
        ...s,
        owners: (s.owners ?? []).filter((o) => o.name.trim() || o.tgId.trim()),
        couriers: (s.couriers ?? []).filter((c) => c.name.trim() || c.tgId.trim()),
      }
      const saved = await api.updateSettings(service, cleaned)
      // the backend strips keys its schema does not know; keep them locally and warn
      const dropped: string[] = []
      const keep: Partial<MarketSettings> = {}
      const check = (key: 'promoText' | 'promoButtonText', label: string) => {
        if ((s[key] ?? '') !== '' && !saved[key]) {
          dropped.push(label)
          keep[key] = s[key]
        }
      }
      if (cleaned.owners?.length && !saved.owners) {
        dropped.push('Egalari')
        keep.owners = cleaned.owners
      }
      check('promoText', 'Reklama matni')
      check('promoButtonText', 'Tugma matni')
      setUnsupported(dropped)
      setS({ ...saved, ...keep })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      // backend (re)starts the bot poller right after save
      setTimeout(loadTg, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saqlashda xatolik')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <h1 className="text-xl font-extrabold">Sozlamalar</h1>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-500">Market</h2>
        <Input label="Nomi" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
        <Input label="Shior" value={s.tagline ?? ''} onChange={(e) => setS({ ...s, tagline: e.target.value })} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Telefon" value={s.phone ?? ''} onChange={(e) => setS({ ...s, phone: e.target.value })} />
          <Input label="Telefon 2" value={s.phone2 ?? ''} onChange={(e) => setS({ ...s, phone2: e.target.value })} />
        </div>
        <Input label="Manzil" value={s.address ?? ''} onChange={(e) => setS({ ...s, address: e.target.value })} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Ochilish" type="time" value={s.workingHours.open} onChange={(e) => setS({ ...s, workingHours: { ...s.workingHours, open: e.target.value } })} />
          <Input label="Yopilish" type="time" value={s.workingHours.close} onChange={(e) => setS({ ...s, workingHours: { ...s.workingHours, close: e.target.value } })} />
        </div>
        <label className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
          <span className="text-sm font-semibold">Buyurtma qabul qilish</span>
          <button type="button" onClick={() => setS({ ...s, isOpen: !s.isOpen })} className={cn('relative h-6 w-11 rounded-full transition', s.isOpen ? 'bg-green-500' : 'bg-gray-300')}>
            <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', s.isOpen ? 'left-[22px]' : 'left-0.5')} />
          </button>
        </label>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-500">Yetkazib berish</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Narxi (bazaviy)" type="number" min={0} value={s.deliveryFee} onChange={(e) => setS({ ...s, deliveryFee: Number(e.target.value) })} hint="bazaviy masofagacha" />
          <Input label="Min. buyurtma" type="number" min={0} value={s.minOrder} onChange={(e) => setS({ ...s, minOrder: Number(e.target.value) })} />
          <Input label="Bepul (dan)" type="number" min={0} value={s.freeDeliveryFrom ?? ''} onChange={(e) => setS({ ...s, freeDeliveryFrom: e.target.value ? Number(e.target.value) : undefined })} />
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <div className="mb-2 text-xs font-bold uppercase text-gray-400">Masofa bo‘yicha narx</div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Bazaviy masofa (km)"
              type="number"
              min={0}
              step="0.1"
              inputMode="decimal"
              value={s.deliveryBaseKm ?? 3}
              onChange={(e) => setS({ ...s, deliveryBaseKm: Number(e.target.value) })}
            />
            <Input
              label="Har qo‘shimcha km (so‘m)"
              type="number"
              min={0}
              inputMode="numeric"
              value={s.deliveryPerKm ?? 0}
              onChange={(e) => setS({ ...s, deliveryPerKm: Number(e.target.value) })}
              hint="0 = masofadan qat’i nazar bir xil narx"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Masalan «3 km gacha 10 000, keyin har km +5 000»: Narxi <b>10000</b>, Bazaviy masofa <b>3</b>, Har km <b>5000</b>.
            Boshlangan kilometr to‘liq hisoblanadi (3.2 km → +1 km). Ishlashi uchun pastda market joylashuvi kerak.
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-gray-400">
            <MapPin size={13} /> Market joylashuvi
            {s.location && (
              <a href={mapsLink(s.location.lat, s.location.lng)} target="_blank" rel="noreferrer" className="ml-auto normal-case text-brand underline">
                xaritada
              </a>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Kenglik (lat)"
              type="number"
              step="any"
              inputMode="decimal"
              value={s.location?.lat ?? ''}
              onChange={(e) => setS({ ...s, location: e.target.value ? { lat: Number(e.target.value), lng: s.location?.lng ?? 0 } : null })}
              placeholder="41.3111"
            />
            <Input
              label="Uzunlik (lng)"
              type="number"
              step="any"
              inputMode="decimal"
              value={s.location?.lng ?? ''}
              onChange={(e) => setS({ ...s, location: e.target.value ? { lat: s.location?.lat ?? 0, lng: Number(e.target.value) } : null })}
              placeholder="69.2797"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" loading={locBusy} onClick={pickMyLocation}>
              <Navigation size={14} /> Hozirgi joylashuvni olish
            </Button>
            {s.location && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setS({ ...s, location: null })}>
                <X size={14} /> Tozalash
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">Oshxonada turib «Hozirgi joylashuvni olish» ni bosing, yoki Google Maps’dan koordinatalarni nusxalang.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_DELIVERY.map((d) => (
            <Chip key={d} on={s.deliveryTypes.includes(d)} onClick={() => setS({ ...s, deliveryTypes: toggleIn(s.deliveryTypes, d) })}>
              {DELIVERY_LABEL[d]}
            </Chip>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-500">To‘lov turlari</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_PAYMENTS.map((p) => (
            <Chip key={p} on={s.paymentTypes.includes(p)} onClick={() => setS({ ...s, paymentTypes: toggleIn(s.paymentTypes, p) })}>
              {PAYMENT_LABEL[p]}
            </Chip>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-500">Telegram</h2>
          <button type="button" onClick={loadTg} className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" title="Holatni yangilash">
            <RefreshCw size={15} />
          </button>
        </div>

        {tg && (
          <div className="grid gap-2 rounded-xl bg-gray-50 p-3 text-sm sm:grid-cols-2">
            <Row label="Bot" value={tg.configured ? (tg.botUsername ? `@${tg.botUsername}` : 'token saqlangan') : 'sozlanmagan'} ok={tg.configured} />
            <Row label="Ishlayapti (polling)" value={tg.polling ? 'ha' : 'yo‘q'} ok={tg.polling} />
            <Row label="Guruh" value={tg.groupId ?? '—'} ok={!!tg.groupId} />
            <Row label="Mini app tugmalari" value={tg.webAppButtonsEnabled ? 'yoqilgan' : 'HTTPS kerak'} ok={tg.webAppButtonsEnabled} />
            <div className="sm:col-span-2 text-xs text-gray-500">
              Mini app URL: <span className="font-mono">{tg.appUrl}</span>
            </div>
          </div>
        )}

        <div className="relative">
          <Input
            label="Bot token"
            type={showToken ? 'text' : 'password'}
            value={s.telegramBotToken ?? ''}
            onChange={(e) => setS({ ...s, telegramBotToken: e.target.value })}
            placeholder="123456789:AAH..."
            autoComplete="off"
            hint="@BotFather dan olingan token. Saqlagach bot avtomatik ishga tushadi."
          />
          <button type="button" onClick={() => setShowToken((v) => !v)} className="absolute right-3 top-8 text-gray-400" aria-label="Ko‘rsatish">
            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Guruh chat ID"
            value={s.telegramGroupId ?? ''}
            onChange={(e) => setS({ ...s, telegramGroupId: e.target.value })}
            placeholder="-1001234567890"
            hint="Botni guruhga admin qilib qo‘shing."
          />
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-gray-400">
            Egalari (owner) {owners.length > 0 && <span className="normal-case text-gray-400">· {owners.length} ta</span>}
          </div>
          <p className="mb-2 text-xs text-gray-500">
            Har bir buyurtma shu odamlarning shaxsiy chatiga <b>tugmalar bilan</b> boradi. Kim birinchi bossa holat o‘zgaradi va qolganlarning xabari ham yangilanadi.
            Har biri botga bir marta <span className="font-mono">/start</span> bosgan bo‘lishi kerak.
          </p>
          {owners.length === 0 && <div className="mb-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-500">Hozircha egasi qo‘shilmagan — buyurtmalar faqat guruhga boradi.</div>}
          <div className="space-y-2">
            {owners.map((o, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <Input label={i === 0 ? 'Ismi' : undefined} value={o.name} onChange={(e) => setOwner(i, { name: e.target.value })} placeholder="Asilbek" />
                <Input
                  label={i === 0 ? 'Telegram ID' : undefined}
                  value={o.tgId}
                  onChange={(e) => setOwner(i, { tgId: e.target.value.replace(/\D/g, '') })}
                  placeholder="123456789"
                  inputMode="numeric"
                />
                <button type="button" onClick={() => removeOwner(i)} className="mb-0.5 rounded-xl p-3 text-red-500 hover:bg-red-50" aria-label="O‘chirish">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={addOwner} disabled={owners.length >= 20}>
            <Plus size={14} /> Egasi qo‘shish
          </Button>
        </div>
        <p className="text-xs text-gray-400">
          Chat ID ni bilish uchun botga yozing yoki @userinfobot dan foydalaning. Guruh ID lari <span className="font-mono">-100</span> bilan boshlanadi.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" loading={tgBusy} onClick={testTelegram}>
            <Send size={14} /> Guruhga sinov xabari
          </Button>
          {tgMsg && <span className={cn('text-sm', tgMsg.ok ? 'text-green-600' : 'text-red-600')}>{tgMsg.text}</span>}
          {isMock && <span className="text-xs text-gray-400">(mock rejim)</span>}
        </div>
        <p className="text-xs text-gray-400">Sinov xabari saqlangan sozlamalar bilan yuboriladi — token yoki ID ni o‘zgartirgan bo‘lsangiz avval «Saqlash» bosing.</p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Bike size={16} className="text-brand" />
          <h2 className="text-sm font-bold text-gray-500">Yetkazuvchilar</h2>
          <span className="text-xs text-gray-400">{couriers.length ? `${couriers.length} ta` : ''}</span>
        </div>
        <p className="text-xs text-gray-500">
          Yetkazib berish buyurtmasi <b>qabul qilingan</b> zahoti har bir yetkazuvchining shaxsiy chatiga to‘liq ma’lumot boradi:
          manzil, xarita, telefon, mahsulotlar va olinadigan summa. Holat o‘zgarganda xabar yangilanadi.
          Yetkazuvchi botga bir marta <span className="font-mono">/start</span> bosgan bo‘lishi kerak.
        </p>

        {couriers.length === 0 && <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">Hozircha yetkazuvchi qo‘shilmagan.</div>}

        <div className="space-y-2">
          {couriers.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <Input label={i === 0 ? 'Ismi' : undefined} value={c.name} onChange={(e) => setCourier(i, { name: e.target.value })} placeholder="Ali" />
              <Input
                label={i === 0 ? 'Telegram ID' : undefined}
                value={c.tgId}
                onChange={(e) => setCourier(i, { tgId: e.target.value.replace(/\D/g, '') })}
                placeholder="123456789"
                inputMode="numeric"
              />
              <button type="button" onClick={() => removeCourier(i)} className="mb-0.5 rounded-xl p-3 text-red-500 hover:bg-red-50" aria-label="O‘chirish">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <Button type="button" variant="secondary" size="sm" onClick={addCourier} disabled={couriers.length >= 50}>
          <Plus size={14} /> Yetkazuvchi qo‘shish
        </Button>
        <p className="text-xs text-gray-400">ID ni @userinfobot dan oling. Guruh ID lari (manfiy) bu yerga to‘g‘ri kelmaydi — faqat shaxsiy foydalanuvchi ID.</p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-brand" />
          <h2 className="text-sm font-bold text-gray-500">Mini app reklama xabari</h2>
        </div>
        <p className="text-xs text-gray-500">
          Guruhga «mini app ochish» tugmali xabar yuboradi. Odamlar tugmani bosib to‘g‘ridan-to‘g‘ri menyuni ochadi va zakaz beradi.
        </p>

        <Textarea label="Xabar matni" rows={3} value={promoText} onChange={(e) => setS({ ...s, promoText: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Tugma matni" value={promoButtonText} onChange={(e) => setS({ ...s, promoButtonText: e.target.value })} maxLength={40} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Qayerga</span>
            <select value={promoTarget} onChange={(e) => setPromoTarget(e.target.value as PromoTarget)} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3">
              <option value="group">Guruhga</option>
              <option value="owner">Egalariga (shaxsiy chatlar)</option>
              <option value="both">Ikkalasiga</option>
            </select>
          </label>
        </div>

        {/* preview */}
        <div>
          <div className="mb-1.5 text-xs font-bold uppercase text-gray-400">Ko‘rinishi</div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="px-4 py-3 text-[15px] leading-snug text-white" style={{ background: '#5c6b8c' }}>
              <div className="mb-1 text-xs text-white/70">{s.name}</div>
              <div className="whitespace-pre-wrap">{promoText || <span className="text-white/50">matn kiriting…</span>}</div>
            </div>
            <div className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white" style={{ background: '#4a9e5c' }}>
              {promoButtonText}
              <ExternalLink size={14} />
            </div>
          </div>
          {tg && !tg.webAppButtonsEnabled && (
            <p className="mt-1.5 text-xs text-amber-600">
              Mini app tugmasi faqat HTTPS manzilda ishlaydi. Hozir havola sifatida yuboriladi.
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={promoPin} onChange={(e) => setPromoPin(e.target.checked)} /> Xabarni chatga qadab qo‘yish (pin)
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" loading={promoBusy} onClick={sendPromo}>
            <Megaphone size={14} /> Xabarni yuborish
          </Button>
          {promoMsg && <span className={cn('text-sm', promoMsg.ok ? 'text-green-600' : 'text-red-600')}>{promoMsg.text}</span>}
        </div>
        <p className="text-xs text-gray-400">Matn va tugma matni «Saqlash» bosilganda saqlanadi. Yuborish esa saqlangan bot tokeni bilan ishlaydi.</p>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>
          Saqlash
        </Button>
        {saved && <span className="text-sm text-green-600">Saqlandi ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {unsupported.length > 0 && (
        <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          Backend hali bu maydonlarni saqlamaydi: <b>{unsupported.join(', ')}</b>. Qiymatlar shu sahifada turadi, lekin
          sahifani yangilasangiz yo‘qoladi. Nima qilish kerakligi <span className="font-mono">NEW_FEATURES.md</span> da yozilgan.
        </div>
      )}
    </form>
  )
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className={cn('font-semibold', ok ? 'text-green-700' : 'text-gray-700')}>
        {ok ? '● ' : '○ '}
        {value}
      </span>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn('rounded-full border px-3.5 py-1.5 text-sm font-semibold', on ? 'border-brand bg-brand-soft text-brand' : 'border-gray-200 text-gray-600')}>
      {children}
    </button>
  )
}
