'use client'

// Speaker-attributed verbatim transcript with: collapsible analysis strip
// (objections / buying signals / commitments / risks with quote-to-moment
// jump), in-transcript search with N/M stepping, signal-moment markers
// (orange border on turns matched by analysis quotes), copy-transcript, and
// Buyer/Seller role badges by email domain (omitted when not confident).
// Transcripts are never edited: STT quirks render as-is.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface TRow {
  meeting_uuid: string; topic?: string | null; start_time?: string | null
  duration?: number | null; transcript_text?: string | null
  participants?: Array<{ name?: string | null; email?: string | null }> | null
  sentiment?: string | null; sentiment_shift?: string | null; sentiment_reason?: string | null
  summary_text?: string | null; analysis_confidence?: number | null
  objections?: Array<{ note?: string; type?: string; quote?: string }> | null
  buying_signals?: Array<{ note?: string; quote?: string }> | null
  commitments?: Array<{ who?: string; what?: string }> | null
  risk_flags?: Array<{ flag?: string; quote?: string }> | null
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export function TranscriptViewer({ row, userEmail }: { row: TRow | null; userEmail: string }) {
  const router = useRouter()
  const [openStrip, setOpenStrip] = useState(false)
  const [q, setQ] = useState('')
  const [hitIdx, setHitIdx] = useState(0)
  const [flash, setFlash] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const turns = useMemo(() => {
    const out: Array<{ sp: string; tx: string }> = []
    for (const line of String(row?.transcript_text || '').split('\n')) {
      const m = line.match(/^([^:]{1,50}):\s*(.*)$/)
      if (m && m[2].trim()) out.push({ sp: m[1].trim(), tx: m[2].trim() })
      else if (line.trim() && out.length) out[out.length - 1].tx += ' ' + line.trim()
    }
    return out
  }, [row?.transcript_text])

  // Role badges: match speaker name to a participant with an email; the
  // user's domain = Seller, other domains = Buyer. No confident match, no badge.
  const roleOf = useMemo(() => {
    const myDomain = (userEmail.split('@')[1] || '').toLowerCase()
    const map = new Map<string, string>()
    if (!myDomain) return map
    for (const p of (row?.participants || [])) {
      const nm = String(p?.name || '').trim()
      const em = String(p?.email || '').toLowerCase()
      if (!nm || !em.includes('@')) continue
      const dom = em.split('@')[1]
      map.set(norm(nm), dom === myDomain ? 'Seller' : 'Buyer')
    }
    return map
  }, [row?.participants, userEmail])

  // Signal moments: any turn containing an analysis quote fragment.
  const quoteList = useMemo(() => {
    const qs: string[] = []
    for (const o of (row?.objections || [])) if (o?.quote) qs.push(o.quote)
    for (const b of (row?.buying_signals || [])) if (b?.quote) qs.push(b.quote)
    for (const r of (row?.risk_flags || [])) if (r?.quote) qs.push(r.quote)
    return qs
  }, [row])
  const markedTurns = useMemo(() => {
    const set = new Set<number>()
    for (const quote of quoteList) {
      const frag = norm(quote).slice(0, 40)
      if (!frag) continue
      const i = turns.findIndex(t => norm(t.tx).includes(frag))
      if (i >= 0) set.add(i)
    }
    return set
  }, [quoteList, turns])

  const hits = useMemo(() => {
    const needle = norm(q)
    if (needle.length < 2) return []
    return turns.map((t, i) => (norm(t.tx).includes(needle) || norm(t.sp).includes(needle)) ? i : -1).filter(i => i >= 0)
  }, [q, turns])

  const jumpTo = (i: number) => {
    document.getElementById(`turn-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash(i)
    setTimeout(() => setFlash(f => (f === i ? null : f)), 2600)
  }
  const jumpQuote = (quote: string) => {
    const frag = norm(quote).slice(0, 40)
    const i = turns.findIndex(t => norm(t.tx).includes(frag))
    if (i >= 0) jumpTo(i)
  }
  const step = (dir: 1 | -1) => {
    if (!hits.length) return
    const next = ((hitIdx + dir) % hits.length + hits.length) % hits.length
    setHitIdx(next)
    jumpTo(hits[next])
  }
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(turns.map(t => `${t.sp}: ${t.tx}`).join('\n'))
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard denied */ }
  }

  if (!row) {
    return (
      <div className="dsk-screen on">
        <div className="dcard" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>Transcript not found</div>
          <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>It may still be processing, or the link points to a call on another account.</div>
        </div>
      </div>
    )
  }

  const sent = (row.sentiment || '').toLowerCase()
  const sentColor = sent === 'positive' ? 'var(--ok)' : sent === 'negative' ? 'var(--danger)' : 'var(--t3)'
  const counts = [
    ['Objections', (row.objections || []).length],
    ['Buying signals', (row.buying_signals || []).length],
    ['Commitments', (row.commitments || []).length],
    ['Risks', (row.risk_flags || []).length],
  ] as const
  const chip = { fontSize: 10.5, fontWeight: 700 as const, padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t2)' }
  const quoteBtn = { display: 'block', width: '100%', textAlign: 'left' as const, background: 'rgba(255,107,53,.05)', border: 'none', borderLeft: '3px solid var(--o)', borderRadius: '0 8px 8px 0', padding: '8px 12px', margin: '6px 0', fontSize: 11.5, color: 'var(--t2)', fontStyle: 'italic' as const, cursor: 'pointer', lineHeight: 1.5 }

  return (
    <div className="dsk-screen on">
      <div className="page-hdr" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{(row.topic || 'Call transcript').replace(/^(Zoom|Meet|Fireflies):\s*/i, '')}</h1>
          <p>
            {row.start_time ? new Date(row.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}
            {row.duration ? ` · ${row.duration} min` : ''}
            {sent && <span style={{ color: sentColor, fontWeight: 800 }}> · {sent}</span>}
            {row.analysis_confidence != null ? ` · ${row.analysis_confidence}% confidence` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={copyAll} style={{ ...chip, cursor: 'pointer' }}>{copied ? 'Copied ✓' : 'Copy transcript'}</button>
          <button onClick={() => router.back()} style={{ ...chip, cursor: 'pointer' }}>Back</button>
        </div>
      </div>

      {/* Analysis strip */}
      {(row.summary_text || quoteList.length > 0 || (row.commitments || []).length > 0) && (
        <div className="dcard" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div onClick={() => setOpenStrip(o => !o)} style={{ padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--o)', fontFamily: "'DM Mono',monospace" }}>Call Analysis</span>
              {counts.filter(([, n]) => n > 0).map(([lbl, n]) => (
                <span key={lbl} style={chip}>{n} {lbl.toLowerCase()}</span>
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>{openStrip ? '▴' : '▾'}</span>
          </div>
          {openStrip && (
            <div style={{ padding: '0 20px 18px', borderTop: '1px solid var(--line)' }}>
              {row.summary_text && <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6, padding: '14px 0 4px' }}>{row.summary_text}</div>}
              {row.sentiment_shift && <div style={{ fontSize: 11.5, color: 'var(--t3)', lineHeight: 1.55, padding: '8px 0' }}><b style={{ color: sentColor }}>Sentiment shift:</b> {row.sentiment_shift}</div>}
              {(row.objections || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Objections</div>
                  {(row.objections || []).map((o, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 6 }}>{o.type ? <b style={{ textTransform: 'capitalize' }}>{o.type}: </b> : null}{o.note}</div>
                      {o.quote && <button onClick={() => jumpQuote(o.quote!)} style={quoteBtn} title="Jump to this moment">&ldquo;{o.quote}&rdquo;</button>}
                    </div>
                  ))}
                </div>
              )}
              {(row.buying_signals || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Buying signals</div>
                  {(row.buying_signals || []).map((b, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 6 }}>{b.note}</div>
                      {b.quote && <button onClick={() => jumpQuote(b.quote!)} style={quoteBtn} title="Jump to this moment">&ldquo;{b.quote}&rdquo;</button>}
                    </div>
                  ))}
                </div>
              )}
              {(row.commitments || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Commitments</div>
                  {(row.commitments || []).map((c, i) => (
                    <div key={i} style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 6 }}><b>{c.who}:</b> {c.what}</div>
                  ))}
                </div>
              )}
              {(row.risk_flags || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Risks</div>
                  {(row.risk_flags || []).map((r, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 6 }}>{r.flag}</div>
                      {r.quote && <button onClick={() => jumpQuote(r.quote!)} style={quoteBtn} title="Jump to this moment">&ldquo;{r.quote}&rdquo;</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input value={q} onChange={e => { setQ(e.target.value); setHitIdx(0) }} placeholder="Search the transcript"
          style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12.5, background: 'var(--surface)', color: 'var(--t1)', outline: 'none' }} />
        {hits.length > 0 && (
          <>
            <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: "'DM Mono',monospace" }}>{hitIdx + 1}/{hits.length}</span>
            <button onClick={() => step(-1)} style={{ ...chip, cursor: 'pointer' }}>↑</button>
            <button onClick={() => step(1)} style={{ ...chip, cursor: 'pointer' }}>↓</button>
          </>
        )}
        {q.length >= 2 && hits.length === 0 && <span style={{ fontSize: 11, color: 'var(--t4)' }}>No matches</span>}
      </div>

      {/* Transcript */}
      <div className="dcard" style={{ padding: '6px 0' }}>
        {turns.length === 0 && <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 12.5, color: 'var(--t3)' }}>No transcript text available.</div>}
        {turns.map((t, i) => {
          const role = roleOf.get(norm(t.sp))
          const marked = markedTurns.has(i)
          const isFlash = flash === i
          const isHit = hits.includes(i)
          return (
            <div key={i} id={`turn-${i}`} style={{ padding: '10px 20px', borderLeft: marked ? '3px solid var(--o)' : '3px solid transparent', background: isFlash ? 'rgba(255,107,53,.1)' : isHit && hits[hitIdx] === i ? 'rgba(255,107,53,.05)' : 'transparent', transition: 'background .4s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--t1)' }}>{t.sp}</span>
                {role && <span style={{ fontSize: 8.5, fontWeight: 800, color: role === 'Buyer' ? 'var(--o)' : 'var(--t3)', border: `1px solid ${role === 'Buyer' ? 'rgba(255,107,53,.35)' : 'var(--border)'}`, padding: '1px 7px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.5px' }}>{role}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.65 }}>{t.tx}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
