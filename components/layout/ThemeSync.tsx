'use client'
import { useEffect } from 'react'
import { useSettings } from '@/lib/useSettings'
import { applyTheme, currentTheme } from '@/lib/theme'
// If you chose a theme on another device, use it here too (the page itself was already drawn in this
// browser's last theme, so this only ever changes it once).
export function ThemeSync() {
  const { appearance } = useSettings()
  useEffect(() => { if (appearance && appearance !== currentTheme()) applyTheme(appearance) }, [appearance])
  return null
}
