'use client'

import { useEffect, useState } from 'react'
import { X } from '@/components/explain/Explain'

// One truth, a lens for each role. The lens changes which figures come first (and, for a rep,
// which accounts are in scope), never how anything is calculated.
export type LensId = 'rep' | 'manager' | 'cro' | 'cfo'
export const LENSES: Array<{ id: LensId; label: string; question: string }> = [
  { id: 'rep', label: 'Rep', question: 'What\u2019s on my plate today' },
  { id: 'manager', label: 'Manager', question: 'Coverage, and who\u2019s stuck' },
  { id: 'cro', label: 'CRO', question: 'Forecast risk across the pipeline' },
  { id: 'cfo', label: 'CFO', question: 'Revenue at risk, with the proof' },
]

export function useLens(demo: boolean): [LensId, (l: LensId) => void] {
  const [lens, setLens] = useState<LensId>(demo ? 'cro' : 'manager')
  useEffect(() => {
    try { const v = localStorage.getItem('lens') as LensId | null; if (v && LENSES.some(l => l.id === v)) setLens(v) } catch { /* ignore */ }
  }, [])
  const set = (l: LensId) => { setLens(l); try { localStorage.setItem('lens', l) } catch { /* ignore */ } }
  return [lens, set]
}

export function LensSwitcher({ lens, onChange }: { lens: LensId; onChange: (l: LensId) => void }) {
  const cur = LENSES.find(l => l.id === lens)!
  return (
    <div className="lens">
      <span className="lens-lbl">Viewing as</span>
      <div className="lens-seg" role="tablist" aria-label="Role lens">
        {LENSES.map(l => (
          <button key={l.id} role="tab" aria-selected={l.id === lens} className={l.id === lens ? 'on' : ''} onClick={() => onChange(l.id)}>{l.label}</button>
        ))}
      </div>
      <span className="lens-q">{cur.question}</span>
    </div>
  )
}

type Tile = { label: string; valueText: string; sub: string; m: string; scope?: 'me'; tone: 'critical' | 'good' | 'accent' | 'ink' }
const TONE: Record<Tile['tone'], string> = { critical: 'var(--critical, #c43d2b)', good: 'var(--good, #2f8f5b)', accent: 'var(--accent, #E85A25)', ink: 'var(--ink, #0E0D0B)' }

export function LensStrip({ lens }: { lens: Exclude<LensId, 'cro'> }) {
  const [tiles, setTiles] = useState<Tile[] | null>(null)
  useEffect(() => {
    let dead = false; setTiles(null)
    fetch(`/api/lens?lens=${lens}`).then(r => r.ok ? r.json() : null).then(j => { if (!dead && j?.tiles) setTiles(j.tiles) }).catch(() => {})
    return () => { dead = true }
  }, [lens])
  return (
    <div className="lens-strip">
      {(tiles ?? Array.from({ length: 4 }, () => null)).map((t, i) => (
        <div key={i} className="lens-tile">
          <div className="lens-tile-k">{t ? t.label : '\u00a0'}</div>
          <div className="lens-tile-v" style={{ color: t ? TONE[t.tone] : undefined }}>
            {t ? <X m={t.m} scope={t.scope}>{t.valueText}</X> : <span className="sk" style={{ display: 'inline-block', width: 90, height: 34 }} />}
          </div>
          <div className="lens-tile-s">{t ? t.sub : '\u00a0'}</div>
        </div>
      ))}
    </div>
  )
}
