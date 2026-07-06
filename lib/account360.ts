// Real-data Account 360 loader.
//
// The Account360 panel is a pure renderer: it displays whatever A360Data it is
// handed via the `open-a360` event. For DEMO accounts the dispatcher passes a
// rich, hand-authored payload. For REAL users the dispatchers only know an
// account name (from a signal or a portfolio row), so this loader fills in the
// rest from live Supabase data under the user's RLS scope:
//   - the matching accounts row (health, risk, stage, probability, domain)
//   - that account's signals        -> brief, signal list, timeline
//   - messages from the account's domain -> recent comms + people
//
// Everything is best-effort: real accounts routinely have null value/owner and
// signals are free-text-named (not FK-linked), so each section is included only
// when it actually has data. Missing pieces are simply omitted, and the panel
// hides any section/tab that has nothing to show.

import { createClient } from '@/lib/supabase/client'
import type { A360Data, SigItem, CommItem, PersonItem, TimelineItem } from '@/components/account/Account360'

function fmtMoney(v?: number | null): string {
  if (v == null || isNaN(Number(v)) || Number(v) === 0) return ''
  const n = Number(v)
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M'
  if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'K'
  return '$' + n
}

function timeAgo(iso?: string | null): string {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso).getTime()) / 86400000
  if (d < 0) return 'just now'
  if (d < 1) return 'today'
  if (d < 2) return 'yesterday'
  if (d < 30) return `${Math.floor(d)}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

// signals use severity high/watch/positive; the panel's brief/sig colors use
// danger/warn/ok. Map between them in one place.
function sevType(sev?: string): 'danger' | 'warn' | 'ok' {
  if (sev === 'high') return 'danger'
  if (sev === 'positive') return 'ok'
  return 'warn'
}
function sevRisk(sev?: string): string {
  if (sev === 'high') return 'HIGH'
  if (sev === 'positive') return 'LOW'
  return 'MEDIUM'
}
function riskFromLevel(level?: string | null): string | null {
  if (!level) return null
  const l = String(level).toLowerCase()
  if (l === 'high') return 'HIGH'
  if (l === 'medium' || l === 'med') return 'MEDIUM'
  if (l === 'low') return 'LOW'
  return null
}
function sevColor(sev?: string): string {
  if (sev === 'high') return 'var(--danger)'
  if (sev === 'positive') return 'var(--ok)'
  return 'var(--amber)'
}

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

// Safety net: decode any HTML entities that survived ingestion so comms never
// display raw &#39; style codes. Numeric first, &amp; last.
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(parseInt(n, 10)) } catch { return '' } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)) } catch { return '' } })
    .replace(/&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
}

// Clean a Gmail-style "Name <email>" sender down to a display name.
function senderName(raw?: string | null): string {
  if (!raw) return 'Unknown'
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*</)
  const name = (m ? m[1] : raw).trim()
  return name || raw.trim() || 'Unknown'
}

// Derive a health score when the account row has none: start neutral and move
// with the signal mix so the ring reflects real risk rather than showing empty.
function deriveHealth(sigs: { severity?: string }[]): number {
  let h = 68
  for (const s of sigs) {
    if (s.severity === 'high') h -= 22
    else if (s.severity === 'watch') h -= 9
    else if (s.severity === 'positive') h += 7
  }
  return Math.max(8, Math.min(94, h))
}

export async function loadRealAccount360(name: string): Promise<Partial<A360Data>> {
  const supa = createClient()

  // 1) account row (best-effort name match). ilike is case-insensitive; a real
  //    signal name like "Meridian Labs" may have no row at all - that's fine.
  const { data: accs } = await supa
    .from('accounts')
    .select('name, value, stage, owner, risk_level, probability, health_score, domain, last_contact_date')
    .ilike('name', name)
    .limit(1)
  const acc: any = accs?.[0] || null

  // 2) this account's signals (newest first)
  const { data: sigRows } = await supa
    .from('signals')
    .select('signal_type, severity, title, description, risk_amount, ai_analysis, created_at, source_integration')
    .ilike('account_name', name)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(20)
  const sigs = sigRows || []

  // 3) messages from the account's domain (for comms + people). Messages carry
  //    no account link, only sender, so we match on the account's email domain.
  let msgs: any[] = []
  const domain: string = acc?.domain || ''
  if (domain) {
    const { data: m } = await supa
      .from('messages')
      .select('integration, sender, subject, content, received_at, direction')
      .ilike('sender', '%' + domain + '%')
      .order('received_at', { ascending: false })
      .limit(14)
    msgs = m || []
  }

  // ---- assemble ----
  const out: Partial<A360Data> = { name }

  // header / scalars
  if (acc?.stage) out.stage = acc.stage
  out.health = acc?.health_score != null ? Number(acc.health_score) : deriveHealth(sigs)
  out.risk = riskFromLevel(acc?.risk_level) || sevRisk(sigs[0]?.severity) || 'LOW'
  out.rep = acc?.owner || 'You'
  out.signals = sigs.length

  // contact: prefer a real name off the freshest signal's analysis
  const topAi = (sigs.find(s => s.ai_analysis && (s.ai_analysis.contact_name || s.ai_analysis.sender_email))?.ai_analysis) || null
  out.contact = (topAi?.contact_name as string) || (topAi?.sender_email as string) || ''

  // arr: real deal value if present, else total $ at risk across signals, else --
  const riskSum = sigs.reduce((s, x) => s + (Number(x.risk_amount) || 0), 0)
  out.arr = fmtMoney(acc?.value) || (riskSum > 0 ? fmtMoney(riskSum) : '') || '--'

  // days dark + last touch: driven by the most recent real activity we have
  const lastMsgAt = msgs[0]?.received_at || null
  const lastSigAt = sigs[0]?.created_at || null
  const lastAny = [lastMsgAt, lastSigAt, acc?.last_contact_date].filter(Boolean).sort().reverse()[0] || null
  out.daysDark = lastAny ? Math.max(0, Math.floor((Date.now() - new Date(lastAny).getTime()) / 86400000)) : '--'
  if (lastMsgAt) out.lastTouch = `Last message ${timeAgo(lastMsgAt)}`
  else if (sigs[0]?.title) out.lastTouch = sigs[0].title
  else out.lastTouch = 'No recent activity'

  // brief (overview) - the freshest few signals, worded from title/summary
  if (sigs.length) {
    const top = sigs.slice(0, 4)
    out.brief = top.map(s => s.title || (s.ai_analysis?.summary as string) || 'Signal detected')
    out.briefTypes = top.map(s => sevType(s.severity))
  }

  // signals tab
  if (sigs.length) {
    out.sigItems = sigs.map<SigItem>(s => ({
      sev: sevType(s.severity),
      msg: s.title || (s.ai_analysis?.summary as string) || 'Signal detected',
      time: timeAgo(s.created_at),
      via: cap(s.source_integration) || 'Gmail',
    }))
  }

  // comms tab - real messages from the account domain
  if (msgs.length) {
    out.comms = msgs.map<CommItem>(m => ({
      from: senderName(m.sender),
      role: '',
      msg: decodeEntities(String(m.content || '')).replace(/\s+/g, ' ').trim().slice(0, 160),
      time: timeAgo(m.received_at),
      via: cap(m.integration) || 'Gmail',
      dir: m.direction === 'outbound' ? 'out' : 'in',
    }))

    // people tab - distinct inbound senders, most-recent-first, with a simple
    // engagement proxy (how many of the recent messages came from them).
    const seen = new Map<string, { name: string; count: number; last: string }>()
    for (const m of msgs) {
      if (m.direction === 'outbound') continue
      const nm = senderName(m.sender)
      const key = nm.toLowerCase()
      const cur = seen.get(key)
      if (cur) cur.count++
      else seen.set(key, { name: nm, count: 1, last: m.received_at })
    }
    const people = Array.from(seen.values()).slice(0, 6)
    if (people.length) {
      const maxC = Math.max(...people.map(p => p.count))
      out.people = people.map<PersonItem>(p => ({
        name: p.name,
        role: '',
        status: 'Active',
        statusColor: 'var(--ok)',
        last: timeAgo(p.last),
        eng: Math.round((p.count / maxC) * 100),
      }))
    }
  }

  // timeline tab - each signal as a dated event (real, chronological)
  if (sigs.length) {
    out.timeline = sigs.slice(0, 8).map<TimelineItem>(s => ({
      title: s.title || cap(s.signal_type) || 'Signal',
      time: timeAgo(s.created_at),
      desc: s.description || (s.ai_analysis?.summary as string) || '',
      color: sevColor(s.severity),
    }))
  }

  // contracts: real data has none -> omit so the tab hides.
  return out
}
