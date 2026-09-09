/**
 * Registry of every fast-food service hosted on fastfood-markets.uz.
 * Add a new entry here to get /markets/<slug> and /dashboard/<slug>.
 * Live data (menu, prices, working hours) comes from the backend;
 * this file only holds branding fallbacks used before the API responds.
 */
export interface ServiceConfig {
  slug: string
  name: string
  tagline: string
  logo: string
  brand: string
  /** Telegram bot that opens this mini app, e.g. https://t.me/<bot>/<app> */
  botUsername?: string
}

export const services: Record<string, ServiceConfig> = {
  totli_dunyo: {
    slug: 'totli_dunyo',
    name: 'Totli Dunyo',
    tagline: 'Shirinliklar va fast food',
    logo: '🍰',
    brand: '#e11d48',
    botUsername: 'totli_dunyo_bot',
  },
  yulduzcha: {
    slug: 'yulduzcha',
    name: 'Yulduzcha',
    tagline: 'Tez va mazali',
    logo: '⭐',
    brand: '#f59e0b',
    botUsername: 'yulduzcha_bot',
  },
  riza_food: {
    slug: 'riza_food',
    name: 'Riza Food',
    tagline: 'Milliy taomlar va burgerlar',
    logo: '🍔',
    brand: '#16a34a',
    botUsername: 'riza_food_bot',
  },
}

export const serviceList = Object.values(services)

export function getService(slug: string | undefined): ServiceConfig | undefined {
  if (!slug) return undefined
  return services[slug]
}
