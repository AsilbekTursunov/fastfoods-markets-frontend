import type { GeoPoint, Market } from '@/types'

/** Great-circle distance in km. Same formula as the backend, so the estimate matches the bill. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface FeeEstimate {
  fee: number
  distanceKm: number | null
  /** false = the price can still change (distance pricing is on but no location yet) */
  exact: boolean
}

/**
 * Mirrors the backend rule: `deliveryFee` covers the first `deliveryBaseKm`, every started
 * kilometre beyond that adds `deliveryPerKm`; free above `freeDeliveryFrom`.
 * The server recomputes this on every order — the UI only shows it early.
 */
export function estimateDeliveryFee(
  market: Pick<Market, 'deliveryFee' | 'deliveryBaseKm' | 'deliveryPerKm' | 'freeDeliveryFrom' | 'location'>,
  subtotal: number,
  customer: GeoPoint | null,
): FeeEstimate {
  if (market.freeDeliveryFrom && subtotal >= market.freeDeliveryFrom) return { fee: 0, distanceKm: null, exact: true }
  const perKm = market.deliveryPerKm ?? 0
  const baseKm = market.deliveryBaseKm ?? 0
  if (perKm <= 0 || !market.location) return { fee: market.deliveryFee, distanceKm: null, exact: true }
  if (!customer) return { fee: market.deliveryFee, distanceKm: null, exact: false }
  const distanceKm = Math.round(haversineKm(market.location, customer) * 100) / 100
  const fee = distanceKm > baseKm ? market.deliveryFee + Math.ceil(distanceKm - baseKm) * perKm : market.deliveryFee
  return { fee, distanceKm, exact: true }
}

export const usesDistancePricing = (m: Pick<Market, 'deliveryPerKm' | 'location'>) => (m.deliveryPerKm ?? 0) > 0 && !!m.location
