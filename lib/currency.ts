// Currencies Popsicle can display. Amounts are stored in US dollars; the display converts them.
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'SGD' | 'HKD' | 'AUD' | 'CAD' | 'CHF' | 'INR' | 'IDR' | 'KRW' | 'AED' | 'MYR'
export const CURRENCIES: Array<{ code: CurrencyCode; name: string; symbol: string }> = [
  { code: 'USD', name: 'US dollar', symbol: '$' }, { code: 'EUR', name: 'Euro', symbol: '\u20ac' }, { code: 'GBP', name: 'British pound', symbol: '\u00a3' },
  { code: 'JPY', name: 'Japanese yen', symbol: '\u00a5' }, { code: 'CNY', name: 'Chinese yuan', symbol: 'CN\u00a5' }, { code: 'SGD', name: 'Singapore dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong dollar', symbol: 'HK$' }, { code: 'AUD', name: 'Australian dollar', symbol: 'A$' }, { code: 'CAD', name: 'Canadian dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss franc', symbol: 'CHF\u00a0' }, { code: 'INR', name: 'Indian rupee', symbol: '\u20b9' }, { code: 'IDR', name: 'Indonesian rupiah', symbol: 'Rp' },
  { code: 'KRW', name: 'South Korean won', symbol: '\u20a9' }, { code: 'AED', name: 'UAE dirham', symbol: 'AED\u00a0' }, { code: 'MYR', name: 'Malaysian ringgit', symbol: 'RM' },
]
/** Fallback rates (units per US dollar), used only if live rates can't be fetched. Approximate, September 2026. */
export const FALLBACK_RATES: Record<CurrencyCode, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150, CNY: 7.2, SGD: 1.34, HKD: 7.8, AUD: 1.52, CAD: 1.36, CHF: 0.88, INR: 83.5, IDR: 16300, KRW: 1350, AED: 3.67, MYR: 4.6,
}
/** Compact amount in a currency: $1.33M, £850K, ¥199M, Rp21.8B. */
export function formatMoney(usd: number, code: CurrencyCode, rate: number): string {
  const sym = CURRENCIES.find(c => c.code === code)?.symbol ?? '$'
  const v = Math.abs(usd * rate), sign = usd < 0 ? '\u2212' : ''
  const [n, unit] = v >= 1e12 ? [v / 1e12, 'T'] : v >= 1e9 ? [v / 1e9, 'B'] : v >= 1e6 ? [v / 1e6, 'M'] : v >= 1e3 ? [v / 1e3, 'K'] : [v, '']
  const digits = unit === '' ? 0 : n < 10 ? 2 : n < 100 ? 1 : 0
  const txt = n.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  return `${sign}${sym}${txt}${unit}`
}
/** Every US-dollar amount written in a piece of text ($1.33M, $850K, -$85K, $480,000), converted. */
const USD_RE = /(^|[^A-Za-z0-9$])([\u2212+-]?)\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\s?(?:K|M|B|k|bn|m)\b)?/g
export function convertText(text: string, code: CurrencyCode, rate: number): string {
  if (code === 'USD' || text.indexOf('$') < 0) return text
  return text.replace(USD_RE, (_m, pre: string, sign: string, num: string, unit?: string) => {
    const u = (unit ?? '').trim().toLowerCase()
    const mult = u === 'k' ? 1e3 : u === 'm' ? 1e6 : u === 'b' || u === 'bn' ? 1e9 : 1
    const usd = parseFloat(num.replace(/,/g, '')) * mult * (sign === '-' || sign === '\u2212' ? -1 : 1)
    return pre + (sign === '+' ? '+' : '') + formatMoney(usd, code, rate)
  })
}
