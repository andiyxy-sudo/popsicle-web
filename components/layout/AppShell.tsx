'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { getInitials } from '@/lib/utils'

interface AppShellProps {
  user: { email: string; id: string; name?: string }
  isDemo: boolean
  badges?: { portfolio?: number; signals?: number; integrations?: number }
  children: React.ReactNode
}

export function AppShell({ user, isDemo, badges = {}, children }: AppShellProps) {
  const [aiOpen, setAiOpen] = useState(false)

  const initials = isDemo ? 'AG' : getInitials(user.name || user.email.split('@')[0])

  return (
    <>
      <Sidebar user={user} isDemo={isDemo} badges={badges} />
      <div className="main">
        <Topbar signalCount={badges.signals ?? 0} onAskClick={() => setAiOpen(true)} initials={initials} />
        <div className="content">
          {children}
        </div>
      </div>
      {/* AI panel mounts here later */}
      {aiOpen && (
        <div onClick={() => setAiOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
      )}
    </>
  )
}
