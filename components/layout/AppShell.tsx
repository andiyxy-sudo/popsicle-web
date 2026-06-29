'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { AIPanel } from '@/components/ai/AIPanel'
import { Account360 } from '@/components/account/Account360'
import { LiveSignals } from './LiveSignals'
import { getInitials } from '@/lib/utils'

interface AppShellProps {
  user: { email: string; id: string; name?: string }
  isDemo: boolean
  badges?: { portfolio?: number; signals?: number; integrations?: number }
  children: React.ReactNode
}

export function AppShell({ user, isDemo, badges = {}, children }: AppShellProps) {
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrefill, setAiPrefill] = useState<string | undefined>(undefined)

  const initials = isDemo ? 'AG' : getInitials(user.name || user.email.split('@')[0])
  const greetingName = isDemo ? 'Andy' : (user.name || user.email.split('@')[0])

  const handleOpenAI = useCallback(() => { setAiPrefill(undefined); setAiOpen(true) }, [])

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent).detail as { prompt?: string } | undefined
      setAiPrefill(detail?.prompt)
      setAiOpen(true)
    }
    window.addEventListener('open-ai', onOpen as EventListener)
    return () => window.removeEventListener('open-ai', onOpen as EventListener)
  }, [])

  return (
    <>
      <Sidebar user={user} isDemo={isDemo} badges={badges} />
      <div className="main">
        <Topbar signalCount={badges.signals ?? 0} onAskClick={handleOpenAI} initials={initials} />
        <div className="content">
          {children}
        </div>
      </div>
      <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} isDemo={isDemo} greetingName={greetingName} prefill={aiPrefill} />
      <Account360 />
      {!isDemo && <LiveSignals userId={user.id} />}
    </>
  )
}
