/** Service worker registration, install prompt and online state. */

const API_CACHE = 'ffm-api-v2'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let waitingWorker: ServiceWorker | null = null

const installListeners = new Set<(available: boolean) => void>()
const updateListeners = new Set<(available: boolean) => void>()

function emitInstall() {
  installListeners.forEach((fn) => fn(!!deferredPrompt))
}
function emitUpdate() {
  updateListeners.forEach((fn) => fn(!!waitingWorker))
}

export function onInstallAvailable(fn: (available: boolean) => void): () => void {
  installListeners.add(fn)
  fn(!!deferredPrompt)
  return () => installListeners.delete(fn)
}

export function onUpdateAvailable(fn: (available: boolean) => void): () => void {
  updateListeners.add(fn)
  fn(!!waitingWorker)
  return () => updateListeners.delete(fn)
}

/** True once the app runs from the home screen rather than a browser tab. */
export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  const prompt = deferredPrompt
  deferredPrompt = null
  emitInstall()
  await prompt.prompt()
  const { outcome } = await prompt.userChoice
  return outcome === 'accepted'
}

/** Apply a waiting update: the new worker takes over and the page reloads once. */
export function applyUpdate() {
  if (!waitingWorker) return
  waitingWorker.postMessage('SKIP_WAITING')
}

/** Drop cached API responses — called on sign-out so the next account starts clean. */
export async function clearApiCache() {
  try {
    await caches.delete(API_CACHE)
  } catch {
    /* Cache Storage unavailable (private mode, old browser) */
  }
}

export function registerServiceWorker() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    emitInstall()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    emitInstall()
  })

  // the dev server has no service worker: keep HMR untouched
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    // tell the worker where the API lives so it can cache it even on another origin
    let swUrl = '/sw.js'
    const apiBase = import.meta.env.VITE_API_URL
    if (apiBase) {
      try {
        swUrl += `?api=${encodeURIComponent(new URL(apiBase, location.href).origin)}`
      } catch {
        /* malformed VITE_API_URL — fall back to same-origin caching only */
      }
    }

    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        if (reg.waiting) {
          waitingWorker = reg.waiting
          emitUpdate()
        }
        reg.addEventListener('updatefound', () => {
          const next = reg.installing
          if (!next) return
          next.addEventListener('statechange', () => {
            // "installed" with a controller present means an update is ready, not a first install
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = next
              emitUpdate()
            }
          })
        })
      })
      .catch(() => {
        /* unsupported or blocked (some in-app browsers) — the site works as before */
      })

    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      location.reload()
    })
  })
}
