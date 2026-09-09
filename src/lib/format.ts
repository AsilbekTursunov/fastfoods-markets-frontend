export function money(amount: number, currency = "so'm"): string {
  return `${Math.round(amount).toLocaleString('ru-RU').replace(/ /g, ' ')} ${currency}`
}

export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  const n = d.startsWith('998') ? d : `998${d}`
  if (n.length !== 12) return raw
  return `+${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8, 10)} ${n.slice(10, 12)}`
}

export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  const n = d.length === 9 ? `998${d}` : d
  return /^998\d{9}$/.test(n) ? `+${n}` : null
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'hozir'
  if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`
  return new Date(iso).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isWithinWorkingHours(open: string, close: string, now = new Date()): boolean {
  const [oh, om] = open.split(':').map(Number)
  const [ch, cm] = close.split(':').map(Number)
  const cur = now.getHours() * 60 + now.getMinutes()
  const o = oh * 60 + om
  const c = ch * 60 + cm
  if (c > o) return cur >= o && cur < c
  // overnight, e.g. 10:00 - 02:00
  return cur >= o || cur < c
}

export function mapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`
}
