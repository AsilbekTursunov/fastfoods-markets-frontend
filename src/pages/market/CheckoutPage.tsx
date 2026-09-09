import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Phone, CheckCircle2, Navigation } from 'lucide-react'
import { useMarket } from './MarketContext'
import { keyOf, lineName, unitPrice, useMarketCart } from '@/store/cart'
import { api } from '@/lib/api'
import { money, normalizePhone, formatPhone, mapsLink } from '@/lib/format'
import { getInitData, getTgUser, haptic, isTelegram, requestLocation, requestTelegramPhone, tg } from '@/lib/telegram'
import { Button, Input, Textarea, Segmented, cn } from '@/components/ui'
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
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(market.deliveryTypes[0] ?? 'delivery')
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
  const deliveryFee = !isDelivery ? 0 : market.freeDeliveryFrom && cart.subtotal >= market.freeDeliveryFrom ? 0 : market.deliveryFee
  const total = cart.subtotal + deliveryFee

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

  const askLocation = async () => {
    setLocLoading(true)
    haptic('light')
    const loc = await requestLocation()
    setLocLoading(false)
    if (loc) {
      setLocation(loc)
      setErrors((e) => ({ ...e, address: '' }))
      haptic('success')
    } else {
      haptic('error')
      const msg = 'Lokatsiyani olib bo‘lmadi. Manzil yoki mo‘ljalni yozib qoldiring.'
      tg?.showAlert?.(msg) ?? alert(msg)
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Ismingizni kiriting'
    if (!normalizePhone(phone)) e.phone = 'To‘g‘ri telefon raqam kiriting (+998 XX XXX XX XX)'
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
        deliveryType,
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
    <form onSubmit={submit} className="pb-36">
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-[#f5f5f7] px-4 py-3">
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
          <h2 className="text-sm font-bold text-gray-500">Yetkazib berish</h2>
          {market.deliveryTypes.length > 1 && (
            <Segmented
              value={deliveryType}
              onChange={(v) => { haptic('select'); setDeliveryType(v) }}
              options={market.deliveryTypes.map((d) => ({ value: d, label: DELIVERY_LABEL[d] }))}
            />
          )}
          {isDelivery ? (
            <>
              <Button type="button" variant={location ? 'ghost' : 'secondary'} full loading={locLoading} onClick={askLocation}>
                {location ? <CheckCircle2 size={18} className="text-green-600" /> : <Navigation size={18} />}
                {location ? 'Lokatsiya olindi' : 'Lokatsiyani yuborish'}
              </Button>
              {location && (
                <div className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2 text-xs text-green-800">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} /> {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </span>
                  <a href={mapsLink(location.lat, location.lng)} target="_blank" rel="noreferrer" className="font-semibold underline">
                    Xaritada
                  </a>
                </div>
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
          ) : (
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
          <span>{deliveryFee === 0 ? 'Bepul' : money(deliveryFee, market.currency)}</span>
        </div>
        <Button type="submit" full size="lg" loading={submitting}>
          Buyurtmani tasdiqlash · {money(total, market.currency)}
        </Button>
      </div>
    </form>
  )
}
