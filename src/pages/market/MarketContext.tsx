import { createContext, useContext } from 'react'
import type { Market, Product } from '@/types'

export interface MarketCtx {
  market: Market
  products: Product[]
  reload: () => void
}

export const MarketContext = createContext<MarketCtx | null>(null)

export function useMarket(): MarketCtx {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used inside MarketLayout')
  return ctx
}
