import { useEffect, useState } from 'react'

/** Live online/offline state. `navigator.onLine` alone never updates on its own. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

const SYNC_KEY = (key: string) => `ffm:synced:${key}`

/** Remember when data was last loaded from the network (not from the offline cache). */
export function markSynced(key: string) {
  if (!navigator.onLine) return
  try {
    localStorage.setItem(SYNC_KEY(key), new Date().toISOString())
  } catch {
    /* storage full or blocked */
  }
}

export function getSyncedAt(key: string): string | null {
  try {
    return localStorage.getItem(SYNC_KEY(key))
  } catch {
    return null
  }
}
