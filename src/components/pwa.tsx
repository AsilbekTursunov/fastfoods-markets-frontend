import { useEffect, useState } from 'react'
import { CloudOff, Download, RefreshCw } from 'lucide-react'
import { applyUpdate, isInstalled, onInstallAvailable, onUpdateAvailable, promptInstall } from '@/lib/pwa'
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

/** "Install app" button — appears only when the browser actually offers installation. */
export function InstallButton({ variant = 'menu' }: { variant?: 'menu' | 'link' }) {
  const [available, setAvailable] = useState(false)

  useEffect(() => onInstallAvailable(setAvailable), [])

  if (!available || isInstalled()) return null

  const label = 'Ilovani o‘rnatish'
  if (variant === 'link')
    return (
      <button onClick={() => promptInstall()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800">
        <Download size={14} /> {label}
      </button>
    )

  return (
    <button onClick={() => promptInstall()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100">
      <Download size={18} /> {label}
    </button>
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
