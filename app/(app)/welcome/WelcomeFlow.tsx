'use client'

// First-run activation flow. The magic moment: connect Gmail, watch Popsicle
// scan the inbox, see "we found N companies", pick which to track, and land on
// a dashboard that is already alive. Mirrors the mobile onboarding.
//
// State machine: checking -> connect -> scanning -> discovering -> pick ->
// creating -> done (plus 'none' and per-phase error recovery).
// Everything runs against existing edge functions: oauth-gmail (auth-url/sync),
// discover-accounts, enrich-account. Nothing here writes directly to tables.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Phase = 'checking' | 'connect' | 'scanning' | 'discovering' | 'pick' | 'creating' | 'done' | 'none' | 'error'

interface Discovered {
  name: string
  domain: string
  email_count: number
  two_way?: boolean
  last_contact: string | null
  suggested: boolean
}

const FN = (name: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`

// Rotating status lines so the long first sync feels alive, not stuck.
const SCAN_LINES = [
  'Reading your inbox...',
  'Going back through the last 90 days...',
  'Mapping conversations and threads...',
  'Separating real relationships from noise...',
  'Almost there, indexing senders...',
]
const DISCOVER_LINES = [
  'Grouping emails by company...',
  'Filtering out newsletters and tools...',
  'Resolving company names...',
]

function timeAgo(iso?: string | null): string {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso).getTime()) / 86400000
  if (d < 1) return 'today'
  if (d < 2) return 'yesterday'
  if (d < 30) return `${Math.floor(d)}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

export function WelcomeFlow({ name }: { name: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('checking')
  const [statusLine, setStatusLine] = useState('')
  const [discovered, setDiscovered] = useState<Discovered[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [emailsScanned, setEmailsScanned] = useState(0)
  const [createIdx, setCreateIdx] = useState(0)
  const [createName, setCreateName] = useState('')
  const [createdCount, setCreatedCount] = useState(0)
  const [errMsg, setErrMsg] = useState('')
  const [errRetry, setErrRetry] = useState<Phase>('scanning')
  const [manualName, setManualName] = useState('')
  const [manualDomain, setManualDomain] = useState('')
  const startedRef = useRef(false)

  // Manually add a company discovery missed (it filters newsletters, tools and
  // personal domains aggressively, so a real account can be excluded). Accepts
  // an optional email or domain; an email is reduced to its domain.
  function addManual() {
    const name = manualName.trim()
    if (!name) return
    let dom = manualDomain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]
    if (dom.includes('@')) dom = dom.split('@')[1] || ''
    const key = dom || `manual-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    if (discovered.some(c => c.domain === key)) { setManualName(''); setManualDomain(''); return }
    setDiscovered(prev => [{ name, domain: key, email_count: 0, two_way: false, last_contact: null, suggested: true }, ...prev])
    setChecked(prev => new Set(prev).add(key))
    setManualName(''); setManualDomain('')
  }

  const token = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await createClient().auth.getSession()
    return session?.access_token ?? null
  }, [])

  // Rotate status lines during long phases.
  useEffect(() => {
    const lines = phase === 'scanning' ? SCAN_LINES : phase === 'discovering' ? DISCOVER_LINES : null
    if (!lines) return
    let i = 0
    setStatusLine(lines[0])
    const t = setInterval(() => { i = (i + 1) % lines.length; setStatusLine(lines[i]) }, 3500)
    return () => clearInterval(t)
  }, [phase])

  const fail = (msg: string, retryFrom: Phase) => { setErrMsg(msg); setErrRetry(retryFrom); setPhase('error') }

  // ---- phase runners ----

  const runScan = useCallback(async () => {
    setPhase('scanning')
    try {
      const t = await token(); if (!t) return fail('Session expired. Refresh and try again.', 'scanning')
      const r = await fetch(`${FN('oauth-gmail')}?action=sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
        body: JSON.stringify({ action: 'sync', force: true }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok && j?.error !== 'rate_limited') return fail('Inbox scan hit a snag. Your connection is fine, just retry.', 'scanning')
      runDiscover()
    } catch { fail('Inbox scan hit a snag. Your connection is fine, just retry.', 'scanning') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runDiscover = useCallback(async () => {
    setPhase('discovering')
    try {
      const t = await token(); if (!t) return fail('Session expired. Refresh and try again.', 'discovering')
      const r = await fetch(FN('discover-accounts'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
        body: JSON.stringify({ integration: 'gmail', days: 90 }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return fail('Account discovery failed. Retry in a moment.', 'discovering')
      const companies: Discovered[] = j.discovered_companies ?? []
      setEmailsScanned(j.total_emails_scanned ?? 0)
      if (!companies.length) { setPhase('none'); return }
      setDiscovered(companies)
      setChecked(new Set(companies.filter(c => c.suggested).map(c => c.domain)))
      setPhase('pick')
    } catch { fail('Account discovery failed. Retry in a moment.', 'discovering') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runCreate = useCallback(async () => {
    const picks = discovered.filter(c => checked.has(c.domain))
    if (!picks.length) return
    setPhase('creating')
    let done = 0
    const t = await token(); if (!t) return fail('Session expired. Refresh and try again.', 'pick')
    for (let i = 0; i < picks.length; i++) {
      setCreateIdx(i + 1); setCreateName(picks[i].name)
      try {
        const r = await fetch(FN('enrich-account'), {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
          body: JSON.stringify({ account_name: picks[i].name, domain: picks[i].domain.startsWith('manual-') ? undefined : picks[i].domain }),
        })
        if (r.ok) done++
      } catch { /* skip this one, keep going */ }
    }
    setCreatedCount(done)
    setPhase('done')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovered, checked])

  // ---- entry: figure out where the user is ----
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    async function boot() {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user) { router.replace('/login'); return }
      // ?force=1 lets users with existing accounts run discovery again (it
      // already excludes tracked accounts, so re-runs only surface new ones).
      const force = new URLSearchParams(window.location.search).get('force') === '1'
      const [{ count: accCount }, { data: integ }] = await Promise.all([
        supa.from('accounts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supa.from('integrations').select('provider').eq('user_id', user.id).eq('provider', 'gmail').eq('is_active', true).maybeSingle(),
      ])
      if (!force && (accCount ?? 0) > 0) { router.replace('/pulse'); return }
      if (integ) runScan()
      else setPhase('connect')
    }
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connectGmail = async () => {
    const t = await token(); if (!t) return
    const r = await fetch(`${FN('oauth-gmail')}?action=auth-url&platform=web`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
      body: JSON.stringify({ platform: 'web' }),
    })
    const j = await r.json().catch(() => ({}))
    if (j?.url) window.location.href = j.url
  }

  const toggle = (domain: string) => {
    setChecked(prev => { const n = new Set(prev); if (n.has(domain)) n.delete(domain); else n.add(domain); return n })
  }

  // ---- shared UI bits ----
  const Card = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => (
    <div className="dsk-screen on">
      <div className="dcard fade-in" style={{ maxWidth: wide ? 640 : 480, margin: '48px auto 0', padding: wide ? '28px 28px 24px' : '48px 32px', textAlign: wide ? 'left' : 'center' }}>
        {children}
      </div>
    </div>
  )
  const Spinner = () => (
    <div style={{ width: 44, height: 44, margin: '0 auto 20px', border: '3px solid rgba(255,107,53,.15)', borderTopColor: 'var(--o)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  const Cta = ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled} style={{ padding: '12px 26px', background: disabled ? 'var(--t4)' : 'var(--o)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif", boxShadow: disabled ? 'none' : '0 3px 14px rgba(255,107,53,.22)' }}>
      {label}
    </button>
  )

  if (phase === 'checking') return <Card><Spinner /><div style={{ fontSize: 13, color: 'var(--t3)' }}>Just a second...</div></Card>

  if (phase === 'connect') return (
    <Card>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🍦</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Welcome, {name}</div>
      <div style={{ fontSize: 13.5, color: 'var(--t3)', lineHeight: 1.65, maxWidth: 380, margin: '0 auto 8px' }}>
        Popsicle reads your work communications and surfaces revenue signals before deals go quiet.
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--t2)', fontWeight: 600, margin: '0 auto 24px' }}>
        Start by connecting Gmail. We will find your accounts automatically.
      </div>
      <Cta label="Connect Gmail" onClick={connectGmail} />
      <div style={{ fontSize: 11.5, color: 'var(--t4)', marginTop: 16 }}>Read-only access. Disconnect any time.</div>
    </Card>
  )

  if (phase === 'scanning' || phase === 'discovering') return (
    <Card>
      <Spinner />
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>
        {phase === 'scanning' ? 'Scanning your inbox' : 'Finding your accounts'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--t3)', minHeight: 20, transition: 'opacity .3s' }}>{statusLine}</div>
      <div style={{ fontSize: 11.5, color: 'var(--t4)', marginTop: 18 }}>
        {phase === 'scanning' ? 'First scan covers 90 days and can take a minute.' : 'Nearly done.'}
      </div>
    </Card>
  )

  if (phase === 'pick') {
    const nSel = checked.size
    return (
      <Card wide>
        <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>
          {emailsScanned.toLocaleString()} emails scanned
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--t1)', marginBottom: 4 }}>
          We found {discovered.length} compan{discovered.length === 1 ? 'y' : 'ies'} in your inbox
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 14 }}>
          Pick the ones you want Popsicle to watch. Recommended ones are pre-selected.
        </div>
        <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
          <button onClick={() => setChecked(new Set(discovered.map(c => c.domain)))} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: 'var(--o)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Select all</button>
          <button onClick={() => setChecked(new Set())} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: 'var(--t3)', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Clear</button>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', marginBottom: 16 }}>
          {discovered.map(c => {
            const on = checked.has(c.domain)
            return (
              <div key={c.domain} onClick={() => toggle(c.domain)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: on ? 'rgba(255,107,53,.04)' : 'transparent' }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: on ? 'none' : '1.5px solid var(--t4)', background: on ? 'var(--o)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--t1)' }}>{c.name}</span>
                    {c.two_way && <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ok)', background: 'rgba(42,157,92,.1)', padding: '2px 7px', borderRadius: 20, letterSpacing: .4 }}>ACTIVE THREAD</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>{c.domain.startsWith('manual-') ? 'added by you' : c.domain}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)' }}>{c.email_count} emails</div>
                  <div style={{ fontSize: 10.5, color: 'var(--t4)' }}>{timeAgo(c.last_contact)}</div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <input
            value={manualName}
            onChange={e => setManualName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addManual() }}
            placeholder="Add a company Popsicle missed"
            style={{ flex: 1.3, minWidth: 0, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'transparent', color: 'var(--t1)', fontSize: 12.5, fontFamily: "'Outfit',sans-serif", outline: 'none' }}
          />
          <input
            value={manualDomain}
            onChange={e => setManualDomain(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addManual() }}
            placeholder="email or domain (optional)"
            style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'transparent', color: 'var(--t1)', fontSize: 12.5, fontFamily: "'DM Mono',monospace", outline: 'none' }}
          />
          <button onClick={addManual} disabled={!manualName.trim()} style={{ padding: '9px 16px', borderRadius: 9, background: manualName.trim() ? 'var(--o)' : 'var(--t4)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: manualName.trim() ? 'pointer' : 'default', fontFamily: "'Outfit',sans-serif", flexShrink: 0 }}>Add</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>{nSel} selected</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => router.replace('/pulse')} style={{ padding: '12px 18px', background: 'transparent', color: 'var(--t3)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Skip for now</button>
            <Cta label={nSel ? `Track ${nSel} account${nSel === 1 ? '' : 's'}` : 'Select accounts'} onClick={runCreate} disabled={!nSel} />
          </div>
        </div>
      </Card>
    )
  }

  if (phase === 'creating') {
    const total = checked.size
    return (
      <Card>
        <Spinner />
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Setting up your accounts</div>
        <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 14 }}>
          Building a profile for <span style={{ fontWeight: 700, color: 'var(--t2)' }}>{createName}</span> ({createIdx} of {total})
        </div>
        <div style={{ width: 220, height: 5, margin: '0 auto', background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round((createIdx / Math.max(1, total)) * 100)}%`, height: '100%', background: 'var(--o)', borderRadius: 4, transition: 'width .4s' }} />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--t4)', marginTop: 18 }}>Contacts, deal stage, and health scores are extracted from your history.</div>
      </Card>
    )
  }

  if (phase === 'done') return (
    <Card>
      <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(42,157,92,.1)' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2A9D5C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>
        {createdCount} account{createdCount === 1 ? '' : 's'} tracked
      </div>
      <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.65, maxWidth: 380, margin: '0 auto 22px' }}>
        Popsicle is now watching these relationships. Signal detection runs continuously in the background, and new signals will pop up live on your dashboard.
      </div>
      <Cta label="Open my dashboard" onClick={() => { window.location.href = '/pulse' }} />
    </Card>
  )

  if (phase === 'none') return (
    <Card>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Inbox scanned, no companies stood out yet</div>
      <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.65, maxWidth: 400, margin: '0 auto 22px' }}>
        We scanned {emailsScanned.toLocaleString()} emails but did not find clear B2B relationships. You can add accounts manually from the Portfolio screen, or connect Slack and Zoom to give Popsicle more to work with.
      </div>
      <Cta label="Go to dashboard" onClick={() => { window.location.href = '/pulse' }} />
    </Card>
  )

  // error
  return (
    <Card>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>That step did not finish</div>
      <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 22px' }}>{errMsg}</div>
      <Cta label="Try again" onClick={() => (errRetry === 'discovering' ? runDiscover() : runScan())} />
    </Card>
  )
}
