import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Phone, CheckCircle2, Navigation, Truck, Store } from 'lucide-react'
import { useMarket } from './MarketContext'
import { keyOf, lineName, unitPrice, useMarketCart } from '@/store/cart'
import { api } from '@/lib/api'
import { money, normalizePhone, formatPhone, mapsLink } from '@/lib/format'
import { estimateDeliveryFee, usesDistancePricing } from '@/lib/geo'
import { getInitData, getTgUser, haptic, isTelegram, requestLocation, requestTelegramPhone, tg } from '@/lib/telegram'
import { Button, Input, Textarea, cn } from '@/components/ui'
import { DELIVERY_LABEL, PAYMENT_LABEL } from '@/components/status'
import type { DeliveryType, GeoPoint, PaymentType } from '@/types'

const LS_PROFILE = 'ffm:profile'

interface Profile {
  name: string
  phone: string
  address: string
}

function loadProfile(): Partial<Profile> {
  try {
    return JSON.parse(localStorage.getItem(LS_PROFILE) || '{}')
  } catch {
    return {}
  }
}

export default function CheckoutPage() {
  const { market } = useMarket()
  const cart = useMarketCart(market.slug)
  const navigate = useNavigate()
  const tgUser = getTgUser()
  const saved = useMemo(loadProfile, [])

  const [name, setName] = useState(saved.name || [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' '))
  const [phone, setPhone] = useState(saved.phone || '')
  // one option offered -> preselect it; two -> the customer must pick, no silent default
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(market.deliveryTypes.length === 1 ? market.deliveryTypes[0] : null)
  const [address, setAddress] = useState(saved.address || '')
  const [location, setLocation] = useState<GeoPoint | null>(null)
  const [paymentType, setPaymentType] = useState<PaymentType>(market.paymentTypes[0] ?? 'cash')
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [locLoading, setLocLoading] = useState(false)
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const submitted = useRef(false)

  useEffect(() => {
    if (cart.lines.length === 0 && !submitted.current) navigate(`/markets/${market.slug}`, { replace: true })
  }, [cart.lines.length, market.slug, navigate])

  const isDelivery = deliveryType === 'delivery'
  const distancePricing = usesDistancePricing(market)
  // same rule as the server; the server still recomputes on submit
  const est = isDelivery ? estimateDeliveryFee(market, cart.subtotal, location) : { fee: 0, distanceKm: null, exact: true }
  const deliveryFee = est.fee
  const total = cart.subtotal + deliveryFee

  // delivery-only market: it is "selected" from the start, so ask for the location right away (once, silently)
  const autoAsked = useRef(false)
  useEffect(() => {
    if (deliveryType === 'delivery' && !location && !autoAsked.current) {
      autoAsked.current = true
      void askLocation(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryType])

  const chooseDelivery = (v: DeliveryType) => {
    haptic('select')
    setDeliveryType(v)
    setErrors((e) => ({ ...e, deliveryType: '' }))
    // location belongs to delivery only: drop it for pickup, ask for it as soon as delivery is chosen
    if (v === 'pickup') setLocation(null)
    // choosing delivery triggers the effect above; allow it to ask again after a pickup→delivery switch
    else autoAsked.current = false
  }

  const askTelegramPhone = async () => {
    setPhoneLoading(true)
    haptic('light')
    const p = await requestTelegramPhone()
    setPhoneLoading(false)
    if (p) {
      setPhone(p)
      setErrors((e) => ({ ...e, phone: '' }))
      haptic('success')
    } else {
      tg?.showAlert?.('Telefon raqamni qo‘lda kiriting') ?? alert('Telefon raqamni qo‘lda kiriting')
    }
  }

  /**
   * Ask the device for its position. `silent` is used for the automatic request that fires
   * when the customer picks delivery: a refusal there is not an error — the address field
   * is still available — so no alert. The manual button keeps the alert.
   */
  const askLocation = async (silent = false) => {
    setLocLoading(true)
    if (!silent) haptic('light')
    const loc = await requestLocation()
    setLocLoading(false)
    if (loc) {
      setLocation(loc)
      setErrors((e) => ({ ...e, address: '' }))
      haptic('success')
    } else if (!silent) {
      haptic('error')
      const msg = 'Lokatsiyani olib bo‘lmadi. Manzil yoki mo‘ljalni yozib qoldiring.'
      tg?.showAlert?.(msg) ?? alert(msg)
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Ismingizni kiriting'
    if (!normalizePhone(phone)) e.phone = 'To‘g‘ri telefon raqam kiriting (+998 XX XXX XX XX)'
    if (!deliveryType) e.deliveryType = 'Yetkazib berish yoki olib ketishni tanlang'
    if (isDelivery && !location && address.trim().length < 5) e.address = 'Manzil yoki mo‘ljalni yozing yoki lokatsiya yuboring'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!validate()) {
      haptic('error')
      return
    }
    setSubmitting(true)
    setServerError(null)
    try {
      const normalized = normalizePhone(phone)!
      localStorage.setItem(LS_PROFILE, JSON.stringify({ name: name.trim(), phone: normalized, address: address.trim() } satisfies Profile))
      const order = await api.createOrder(market.slug, {
        items: cart.lines.map((l) => ({ productId: l.product.id, variantId: l.variant?.id, qty: l.qty })),
        customer: { name: name.trim(), phone: normalized, tgId: tgUser?.id, tgUsername: tgUser?.username },
        deliveryType: deliveryType!,
        address: isDelivery ? address.trim() || undefined : undefined,
        location: isDelivery && location ? location : undefined,
        paymentType,
        comment: comment.trim() || undefined,
        initData: getInitData(),
      })
      submitted.current = true
      navigate(`/markets/${market.slug}/success/${order.id}`, { replace: true, state: { order } })
      cart.clear()
      haptic('success')
    } catch (e) {
      haptic('error')
      setServerError(e instanceof Error ? e.message : 'Buyurtma yuborilmadi. Qayta urinib ko‘ring.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="pb-bar-lg">
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-[#f5f5f7] px-4 pb-3 pt-safe">
        <button type="button" onClick={() => navigate(-1)} className="rounded-xl bg-white p-2 shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Buyurtma ma’lumotlari</h1>
      </div>

      <div className="space-y-4 px-4">
        {/* summary */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-gray-500">Buyurtma ({cart.count} dona)</h2>
          <ul className="space-y-1 text-sm">
            {cart.lines.map((l) => (
              <li key={keyOf(l)} className="flex justify-between gap-2">
                <span className="text-gray-700">
                  {lineName(l)} <span className="text-gray-400">× {l.qty}</span>
                </span>
                <span className="shrink-0 font-medium">{money(l.qty * unitPrice(l), market.currency)}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => navigate(-1)} className="mt-2 text-xs font-semibold text-brand">
            Miqdorni o‘zgartirish
          </button>
        </section>

        {/* contact */}
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-500">Aloqa</h2>
          <Input label="Ismingiz" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Ism" autoComplete="name" />
          <div>
            <Input
              label="Telefon raqam"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => normalizePhone(phone) && setPhone(formatPhone(phone))}
              error={errors.phone}
              placeholder="+998 90 123 45 67"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
            />
            {isTelegram && (
              <Button type="button" variant="secondary" size="sm" className="mt-2" loading={phoneLoading} onClick={askTelegramPhone}>
                <Phone size={16} /> Telegramdan raqamni olish
              </Button>
            )}
          </div>
        </section>

        {/* delivery */}
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-500">Qanday olasiz?</h2>
          {market.deliveryTypes.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {market.deliveryTypes.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => chooseDelivery(d)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm font-semibold transition',
                    deliveryType === d ? 'border-brand bg-brand-soft text-brand' : 'border-gray-200 text-gray-700',
                  )}
                >
                  {d === 'delivery' ? <Truck size={20} /> : <Store size={20} />}
                  {DELIVERY_LABEL[d]}
                </button>
              ))}
            </div>
          )}
          {errors.deliveryType && <div className="text-xs text-red-600">{errors.deliveryType}</div>}
          {deliveryType === null && !errors.deliveryType && <div className="text-xs text-gray-400">Davom etish uchun birini tanlang</div>}
          {isDelivery && (
            <>
              <Button type="button" variant={location ? 'ghost' : 'secondary'} full loading={locLoading} onClick={() => askLocation()}>
                {location ? <CheckCircle2 size={18} className="text-green-600" /> : <Navigation size={18} />}
                {location ? 'Lokatsiya olindi' : 'Lokatsiyani yuborish'}
              </Button>
              {location ? (
                <div className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2 text-xs text-green-800">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} /> {est.distanceKm != null ? `${est.distanceKm} km` : `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
                  </span>
                  <a href={mapsLink(location.lat, location.lng)} target="_blank" rel="noreferrer" className="font-semibold underline">
                    Xaritada
                  </a>
                </div>
              ) : (
                distancePricing && (
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Narx masofaga qarab: {market.deliveryBaseKm} km gacha {money(market.deliveryFee, market.currency)}, keyin har km +{money(market.deliveryPerKm ?? 0, market.currency)}.
                    Aniq narxni ko‘rish uchun lokatsiya yuboring.
                  </div>
                )
              )}
              <Textarea
                label={location ? 'Mo‘ljal / qo‘shimcha (ixtiyoriy)' : 'Manzil yoki mo‘ljal'}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                error={errors.address}
                rows={2}
                placeholder="Masalan: Chilonzor 19-kvartal, 12-uy, 3-podyezd, 'Korzinka' yonida"
              />
            </>
          )}
          {deliveryType === 'pickup' && (
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <div className="font-semibold">{market.name}</div>
              <div className="text-gray-500">{market.address}</div>
            </div>
          )}
        </section>

        {/* payment */}
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-500">To‘lov turi</h2>
          <div className="grid grid-cols-2 gap-2">
            {market.paymentTypes.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { haptic('select'); setPaymentType(p) }}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                  paymentType === p ? 'border-brand bg-brand-soft text-brand' : 'border-gray-200 text-gray-700',
                )}
              >
                {PAYMENT_LABEL[p]}
              </button>
            ))}
          </div>
        </section>

        {/* comment */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <Textarea label="Izoh (ixtiyoriy)" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Masalan: piyozsiz, qo‘ng‘iroq qilmang, eshik oldida qoldiring" />
        </section>

        {serverError && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg bg-white/90 px-4 pt-3 pb-safe backdrop-blur">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-gray-500">Yetkazib berish</span>
          <span>
            {deliveryType === 'pickup'
              ? 'Olib ketish · 0'
              : deliveryType === null
                ? '—'
                : deliveryFee === 0
                  ? 'Bepul'
                  : `${money(deliveryFee, market.currency)}${est.exact ? (est.distanceKm != null ? ` · ${est.distanceKm} km` : '') : ' dan'}`}
          </span>
        </div>
        <Button type="submit" full size="lg" loading={submitting}>
          Buyurtmani tasdiqlash · {money(total, market.currency)}
        </Button>
      </div>
    </form>
  )
}
