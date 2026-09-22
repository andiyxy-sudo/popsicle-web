// Light, Dark or Match system. Stored in the browser (so it applies before the page draws) and on your
// account (so it follows you to other devices).
let media: MediaQueryList | null = null
const onSystem = () => apply()
function apply() {
  let t = 'Light'
  try { t = localStorage.getItem('theme') || 'Light' } catch { /* ignore */ }
  const dark = t === 'Dark' || (t === 'Match system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  if (t === 'Match system' && !media) { media = window.matchMedia('(prefers-color-scheme: dark)'); media.addEventListener('change', onSystem) }
  if (t !== 'Match system' && media) { media.removeEventListener('change', onSystem); media = null }
}
export function applyTheme(label: string) {
  try { localStorage.setItem('theme', label) } catch { /* ignore */ }
  apply()
}
export function currentTheme(): string { try { return localStorage.getItem('theme') || 'Light' } catch { return 'Light' } }
