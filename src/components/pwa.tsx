import { useEffect, useState } from 'react'
import { CloudOff, Download, RefreshCw, Share, SquarePlus, EllipsisVertical, Compass } from 'lucide-react'
import { applyUpdate, isAndroid, isIOS, isIOSSafari, isInstalled, onInstallAvailable, onUpdateAvailable, promptInstall } from '@/lib/pwa'
import { isTelegram } from '@/lib/telegram'
import { Sheet } from './ui'
import { getSyncedAt, useOnline } from '@/lib/offline'
import { timeAgo } from '@/lib/format'
import { cn } from './ui'

/**
 * Shown only while the device is offline. The page keeps working on the data
 * the service worker already stored, so this just explains why nothing is new.
 */
export function OfflineBanner({ syncKey, className }: { syncKey?: string; className?: string }) {
  const online = useOnline()
  if (online) return null
  const at = syncKey ? getSyncedAt(syncKey) : null
  return (
    <div className={cn('flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800', className)}>
      <CloudOff size={16} className="shrink-0" />
      <span>
        Internet yo‘q — saqlangan ma’lumotlar ko‘rsatilmoqda
        {at && <span className="text-amber-700"> (oxirgi yangilanish: {timeAgo(at)})</span>}. Yangi buyurtmalar internet qaytganda ko‘rinadi.
      </span>
    </div>
  )
}

type InstallMode = 'native' | 'ios' | 'android' | 'none'

/**
 * How this device can install the app:
 *   native  — the browser fired beforeinstallprompt (Android Chrome, desktop Chrome/Edge): one tap
 *   ios     — iPhone/iPad: Safari never fires the event, so we show the Share → "Add to Home Screen" steps
 *   android — Android browser without the event (already dismissed, Firefox, Samsung): show the menu steps
 *   none    — already installed, inside Telegram, or a desktop browser without the event
 */
function useInstallMode(): InstallMode {
  const [native, setNative] = useState(false)
  useEffect(() => onInstallAvailable(setNative), [])
  if (isInstalled() || isTelegram) return 'none'
  if (native) return 'native'
  // Android first: a desktop Chrome emulating a phone reports MacIntel + touch, which would look like an iPad
  if (isAndroid()) return 'android'
  if (isIOS()) return 'ios'
  return 'none'
}

/** "Install app" button — hidden wherever installing is impossible or already done. */
export function InstallButton({ variant = 'menu' }: { variant?: 'menu' | 'link' | 'icon' }) {
  const mode = useInstallMode()
  const [help, setHelp] = useState(false)
  if (mode === 'none') return null

  const label = 'Ilovani o‘rnatish'
  const onClick = () => (mode === 'native' ? void promptInstall() : setHelp(true))
  const sheet = <InstallHelpSheet open={help} onClose={() => setHelp(false)} mode={mode} />

  if (variant === 'icon')
    return (
      <>
        <button onClick={onClick} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1.5 text-xs font-bold text-brand active:scale-95" aria-label={label}>
          <Download size={15} /> O‘rnatish
        </button>
        {sheet}
      </>
    )
  if (variant === 'link')
    return (
      <>
        <button onClick={onClick} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800">
          <Download size={14} /> {label}
        </button>
        {sheet}
      </>
    )
  return (
    <>
      <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100">
        <Download size={18} /> {label}
      </button>
      {sheet}
    </>
  )
}

/** Step-by-step instructions for browsers that have no install prompt of their own. */
function InstallHelpSheet({ open, onClose, mode }: { open: boolean; onClose: () => void; mode: InstallMode }) {
  const safari = isIOSSafari()
  return (
    <Sheet open={open} onClose={onClose} title="Ilovani telefonga o‘rnatish">
      <p className="mb-3 text-sm text-gray-600">
        O‘rnatilgan ilova bosh ekrandan bir bosishda ochiladi, to‘liq ekranda ishlaydi va internet bo‘lmaganda ham oxirgi ma’lumotlarni ko‘rsatadi.
      </p>
      {mode === 'ios' ? (
        <ol className="space-y-3 text-sm">
          {!safari && (
            <li className="flex gap-3 rounded-xl bg-amber-50 p-3 text-amber-900">
              <Compass size={20} className="shrink-0" />
              <span>
                Avval shu sahifani <b>Safari</b> brauzerida oching — iPhone’da faqat Safari ilovani ekranga qo‘sha oladi.
              </span>
            </li>
          )}
          <Step n={1} icon={<Share size={20} />}>
            Pastdagi <b>Ulashish</b> (kvadratdan chiqayotgan strelka) tugmasini bosing.
          </Step>
          <Step n={2} icon={<SquarePlus size={20} />}>
            Ro‘yxatdan <b>«Ekranga qo‘shish»</b> (Add to Home Screen) ni tanlang — pastroqda bo‘lishi mumkin.
          </Step>
          <Step n={3} icon={<Download size={20} />}>
            O‘ng yuqoridagi <b>«Qo‘shish»</b> ni bosing. Ilova bosh ekranda paydo bo‘ladi.
          </Step>
        </ol>
      ) : (
        <ol className="space-y-3 text-sm">
          <Step n={1} icon={<EllipsisVertical size={20} />}>
            Brauzerning yuqori o‘ng burchagidagi <b>⋮</b> menyusini oching.
          </Step>
          <Step n={2} icon={<Download size={20} />}>
            <b>«Ilovani o‘rnatish»</b> yoki <b>«Bosh ekranga qo‘shish»</b> ni tanlang va tasdiqlang.
          </Step>
        </ol>
      )}
      <button onClick={onClose} className="mb-2 mt-4 w-full rounded-xl bg-gray-900 py-3 font-semibold text-white">
        Tushunarli
      </button>
    </Sheet>
  )
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-extrabold text-brand">{n}</span>
      <span className="mt-1 shrink-0 text-gray-500">{icon}</span>
      <span className="pt-1 text-gray-700">{children}</span>
    </li>
  )
}

/** Non-blocking prompt: a new build is cached and applies when the user chooses. */
export function UpdateBanner() {
  const [available, setAvailable] = useState(false)
  useEffect(() => onUpdateAvailable(setAvailable), [])
  if (!available) return null
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-sm text-white">
      <RefreshCw size={15} />
      <span>Ilovaning yangi versiyasi tayyor.</span>
      <button onClick={applyUpdate} className="ml-auto rounded-lg bg-white px-3 py-1 text-xs font-bold text-gray-900">
        Yangilash
      </button>
    </div>
  )
}
