'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readSettings, type Settings } from '@/lib/settings'

// The signed-in person's settings in the browser. Re-reads when the Settings page saves ('settings:changed').
let cache: Settings | null = null
export function useSettings(): Settings {
  const [s, setS] = useState<Settings>(cache ?? readSettings(null))
  useEffect(() => {
    let dead = false
    const load = () => createClient().auth.getUser().then(({ data }) => { cache = { ...readSettings(data.user?.user_metadata), demo: data.user?.email === 'demo@popsicle-labs.app' }; if (!dead) setS(cache) }).catch(() => {})
    load()
    window.addEventListener('settings:changed', load)
    return () => { dead = true; window.removeEventListener('settings:changed', load) }
  }, [])
  return s
}
export function getSettingsNow(): Settings { return cache ?? readSettings(null) }
