/* Minimal typings + helpers for Telegram Mini App SDK (telegram-web-app.js) */

export interface TgUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

interface TgLocationData {
  latitude: number
  longitude: number
  altitude?: number
  course?: number
  speed?: number
  horizontal_accuracy?: number
}

interface TgLocationManager {
  isInited: boolean
  isLocationAvailable: boolean
  isAccessRequested: boolean
  isAccessGranted: boolean
  init(cb?: () => void): void
  getLocation(cb: (data: TgLocationData | null) => void): void
  openSettings(): void
}

interface TgContactEvent {
  status: 'sent' | 'cancelled'
  responseUnsafe?: {
    contact?: { phone_number: string; first_name?: string; last_name?: string; user_id?: number }
  }
}

export interface TgWebApp {
  initData: string
  initDataUnsafe: { user?: TgUser; start_param?: string; query_id?: string }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  isExpanded: boolean
  viewportHeight: number
  /** Bot API 8.0+: device notch / home indicator and the Telegram header in fullscreen */
  safeAreaInset?: { top: number; bottom: number; left: number; right: number }
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number }
  ready(): void
  expand(): void
  close(): void
  isVersionAtLeast(v: string): boolean
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  enableClosingConfirmation(): void
  disableClosingConfirmation(): void
  onEvent(event: string, cb: (...args: any[]) => void): void
  offEvent(event: string, cb: (...args: any[]) => void): void
  requestContact(cb?: (sent: boolean) => void): void
  openLink(url: string, opts?: { try_instant_view?: boolean }): void
  openTelegramLink(url: string): void
  showAlert(msg: string, cb?: () => void): void
  showConfirm(msg: string, cb?: (ok: boolean) => void): void
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }
  MainButton: {
    text: string
    isVisible: boolean
    setText(t: string): void
    show(): void
    hide(): void
    enable(): void
    disable(): void
    showProgress(leaveActive?: boolean): void
    hideProgress(): void
    onClick(cb: () => void): void
    offClick(cb: () => void): void
    setParams(p: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }): void
  }
  BackButton: {
    isVisible: boolean
    show(): void
    hide(): void
    onClick(cb: () => void): void
    offClick(cb: () => void): void
  }
  LocationManager?: TgLocationManager
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp }
  }
}

export const tg: TgWebApp | undefined =
  typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined

export const isTelegram = Boolean(tg && tg.initData)

/**
 * Publish Telegram's safe areas as CSS variables so pages can keep content clear of the
 * notch, the home indicator and the mini-app header. The CSS falls back to env() when
 * these stay at 0 (browser, old clients).
 */
function applySafeArea() {
  if (!tg) return
  const root = document.documentElement.style
  const sa = tg.safeAreaInset ?? { top: 0, bottom: 0 }
  const ca = tg.contentSafeAreaInset ?? { top: 0, bottom: 0 }
  root.setProperty('--tg-top', `${(sa.top ?? 0) + (ca.top ?? 0)}px`)
  root.setProperty('--tg-bottom', `${(sa.bottom ?? 0) + (ca.bottom ?? 0)}px`)
}

let safeAreaBound = false

export function initTelegram(brand?: string) {
  if (!tg) return
  try {
    tg.ready()
    tg.expand()
    if (brand) {
      tg.setHeaderColor(brand)
    }
    applySafeArea()
    if (!safeAreaBound) {
      safeAreaBound = true
      tg.onEvent('safeAreaChanged', applySafeArea)
      tg.onEvent('contentSafeAreaChanged', applySafeArea)
      tg.onEvent('viewportChanged', applySafeArea)
    }
  } catch {
    /* ignore - old client */
  }
}

export function getTgUser(): TgUser | undefined {
  return tg?.initDataUnsafe?.user
}

export function getInitData(): string | undefined {
  return tg?.initData || undefined
}

export function haptic(type: 'light' | 'medium' | 'success' | 'error' | 'select' = 'light') {
  try {
    if (!tg) return
    if (type === 'success' || type === 'error') tg.HapticFeedback.notificationOccurred(type)
    else if (type === 'select') tg.HapticFeedback.selectionChanged()
    else tg.HapticFeedback.impactOccurred(type)
  } catch {
    /* ignore */
  }
}

/**
 * Ask Telegram for the user's phone number.
 * Resolves with the phone if the client shares it with the web app
 * (Bot API 6.9+ sends it in the `contactRequested` event), otherwise null.
 */
export function requestTelegramPhone(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!tg || !isTelegram) return resolve(null)
    let done = false
    const finish = (v: string | null) => {
      if (done) return
      done = true
      tg.offEvent('contactRequested', handler)
      resolve(v)
    }
    const handler = (e: TgContactEvent) => {
      const phone = e?.responseUnsafe?.contact?.phone_number
      finish(phone ? (phone.startsWith('+') ? phone : `+${phone}`) : null)
    }
    tg.onEvent('contactRequested', handler)
    try {
      tg.requestContact((sent) => {
        if (!sent) finish(null)
        // if sent, wait for the event which carries the phone number
        setTimeout(() => finish(null), 3000)
      })
    } catch {
      finish(null)
    }
  })
}

/**
 * Get user location: Telegram LocationManager (Bot API 8.0+) first,
 * browser geolocation as fallback. Resolves null if not possible.
 */
export function requestLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    const browserFallback = () => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 },
      )
    }

    const lm = tg?.LocationManager
    if (!lm || !isTelegram) return browserFallback()

    const get = () => {
      if (!lm.isLocationAvailable) return browserFallback()
      lm.getLocation((data) => {
        if (data) resolve({ lat: data.latitude, lng: data.longitude })
        else browserFallback()
      })
    }
    try {
      if (lm.isInited) get()
      else lm.init(get)
    } catch {
      browserFallback()
    }
  })
}
