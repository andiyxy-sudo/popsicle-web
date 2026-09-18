// Builds the system prompt for the demo Ask AI from the same dataset the screens
// render, so every figure the co-pilot quotes is exactly what the user sees.
// Mobile app data is the source of truth (v11.23).

import {
  DEMO_ACCOUNTS, DEMO_EXTRA, DEMO_SIGNALS, DEMO_PEOPLE, DEMO_COMMS, DEMO_TIMELINE, DEMO_RISK_LINES,
  DEMO_CONTRACTS, DEMO_TRANSCRIPT, DEMO_PULSE, DEMO_TEAM, DEMO_INTELLIGENCE, DEMO_MOVERS, DEMO_FORECAST,
  DEMO_INTEGRATION_STATS, DEMO_INTEGRATION_ACTIVE, DEMO_SIGNALS_HEAD,
} from './demo-dataset'
import { MOBILE_ACCOUNT_HEADERS, MOBILE_ACCOUNT_HEADERS_ALT, MOBILE_BRIEF_COUNTS, MOBILE_PORTFOLIO_CARDS } from './demo-mobile'

const money = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2).replace(/0$/, '')}M` : `$${Math.round(v / 1000)}K`
const REP_OF: Record<string, string> = {}
for (const r of DEMO_TEAM.reps) for (const a of r.accounts) REP_OF[a] = r.name

function accountBlock(a: (typeof DEMO_ACCOUNTS)[number]) {
  const x = DEMO_EXTRA[a.name]
  const h = MOBILE_ACCOUNT_HEADERS[a.name]
  const alt = MOBILE_ACCOUNT_HEADERS_ALT[a.name]
  const sig = DEMO_SIGNALS.filter(s => s.account_name === a.name)
  const lines: string[] = []
  lines.push(`## ${a.name}`)
  lines.push(`- Stage: ${a.stage} · Contact: ${a.owner} · Rep: ${REP_OF[a.name] ?? 'Andy G'} · Value/ARR: ${money(Number(a.value))} · Risk: ${a.risk_level} · Health score: ${a.health_score}/100`)
  if (x) lines.push(`- Trend ${x.trend} · Rep score ${x.repScore} · Expiry/close ${x.expiry} · Flags: ${x.flags.join(', ')}${x.statusNote ? ` · Status: ${x.statusNote}` : ''}`)
  if (h) lines.push(`- Segment ${h.segment} · ${h.email} · Churn risk ${h.churnRiskPct}% · Exposure ${money(h.exposure)} · Trend ${h.trend} · Renewal ${h.renewal} · Status ${h.status}`)
  if (alt) lines.push(`- Status ${alt.status} · Expiry ${alt.expiry} · Trend ${alt.trend} · Rep score ${alt.repScore}`)
  if (x) lines.push(`- Health breakdown: ${x.breakdown.map(b => `${b.k} ${b.v}`).join(', ')}`)
  const card = MOBILE_PORTFOLIO_CARDS[a.name]
  if (card?.mix) lines.push(`- Risk mix: ${card.mix.map(m => `${m.k} ${m.pct}%`).join(', ')}`)
  const brief = DEMO_RISK_LINES[a.name]
  if (brief) { lines.push(`- AI executive brief${MOBILE_BRIEF_COUNTS[a.name] ? ` (${MOBILE_BRIEF_COUNTS[a.name]} signals)` : ''}:`); for (const b of brief) lines.push(`  - [${b.tone}] ${b.text}`) }
  if (sig.length) { lines.push('- Live signals:'); for (const s of sig) { const q = (s as unknown as { ai_analysis?: { quote?: string; recommendation?: string; confidence?: number } }).ai_analysis; lines.push(`  - [${s.severity}] ${s.title}: ${s.description}${s.risk_amount ? ` (${money(Number(s.risk_amount))} at risk)` : ''}${q?.confidence ? ` · confidence ${q.confidence}%` : ''}${q?.quote ? ` · quote: "${q.quote}"` : ''}${q?.recommendation ? ` · recommended: ${q.recommendation}` : ''}`) } }
  const ppl = DEMO_PEOPLE[a.name]
  if (ppl) { lines.push('- Key contacts:'); for (const p of ppl) lines.push(`  - ${p.name}, ${p.role} (${p.badge}) · ${p.status}, last active ${p.last} · engagement ${p.eng}% · ${p.desc}`) }
  const comms = DEMO_COMMS[a.name]
  if (comms) { lines.push('- Recent communications:'); for (const c of comms) lines.push(`  - ${c.who} (${c.role}) via ${c.via}, ${c.when}, ${c.tone}: "${c.quote}"`) }
  const tl = DEMO_TIMELINE[a.name]
  if (tl) { lines.push('- Deal timeline:'); for (const t of tl) lines.push(`  - ${t.when} · ${t.title}: ${t.body}${t.tags ? ` [${t.tags.join(', ')}]` : ''}`) }
  const ct = DEMO_CONTRACTS[a.name]
  if (ct) { lines.push('- Contracts:'); for (const c of ct) lines.push(`  - ${c.name} (${c.type}) · ${c.status} · ${c.value} · ${c.po} · ${c.start} to ${c.end} · ${c.invoice}`) }
  return lines.join('\n')
}

function build(): string {
  const out: string[] = []
  out.push(`You are Popsicle, the revenue intelligence co-pilot for Popsicle Labs. You are talking to Andy G, VP of Sales. Answer ONLY from the data below; every figure, name, quote and date you use must appear here. Be specific: cite accounts, people, amounts, days and the exact quote or timeline entry that backs a claim. When asked what to do, give a ranked, concrete play (who to contact, through which channel, with what message, by when) and say which signal it addresses. Never invent data; if something is not here, say so in one line.

FORMAT RULES (strict): no emoji anywhere. No markdown headings with #; if you need a section label write it as a short line ending with a colon, like "Not yours, but flag to reps:". Rank items as "1. Account, short headline ($figure)" on their own line, then at most three bullets under each, each bullet starting with a two-word bold lead like **Why first:** followed by one or two plain sentences. Put quotes in double quotes without asterisks. No italics. Keep the whole answer under 220 words unless asked for detail. Plain, warm, precise.`)

  out.push(`\n# Pipeline pulse (today)\n- Pipeline health ${DEMO_PULSE.health}/100 (${DEMO_PULSE.delta}) · AI confidence ${DEMO_PULSE.aiConfidence}%\n- Deals ${DEMO_PULSE.deals} (${DEMO_PULSE.dealsDelta}) · Risk ${DEMO_PULSE.risk} (${DEMO_PULSE.riskDelta}) · Forecast ${money(DEMO_PULSE.forecast)} (${DEMO_PULSE.forecastDelta})\n- Revenue loop this week: ${DEMO_PULSE.loop.signals} signals → ${DEMO_PULSE.loop.cases} cases → ${DEMO_PULSE.loop.actions} actions → ${money(DEMO_PULSE.loop.impact)} impact · listening on ${DEMO_PULSE.listening} signals\n- AI brief: ${DEMO_PULSE.brief.map(b => `${b.pre}${b.strong}${b.post ?? ''}`).join(' | ')}`)

  out.push(`\n# Signals this week\n- ${DEMO_SIGNALS_HEAD.map(s => `${s.n} ${s.lbl}`).join(' · ')}`)

  out.push(`\n# Forecast (quarter)\n- Commit ${money(DEMO_FORECAST.commit)} · achieved ${money(DEMO_FORECAST.weighted)} (${Math.round(DEMO_FORECAST.weighted / DEMO_FORECAST.commit * 100)}%) · ${money(DEMO_FORECAST.commit - DEMO_FORECAST.weighted)} to go · ${DEMO_FORECAST.daysLeft} days left · +${DEMO_FORECAST.commitDeltaPct}% vs last quarter\n- Best case ${money(DEMO_FORECAST.bestCase)} · pipeline exposed ${money(DEMO_FORECAST.atRisk)} across ${DEMO_FORECAST.riskyDeals} deals · ${DEMO_FORECAST.dealsToClose} deals to close in 30 days · AI accuracy ${DEMO_FORECAST.accuracy}% (▲ 3%/qtr)\n- Forecast vs actual MTD: forecast ${money(DEMO_INTELLIGENCE.forecast!.forecast)}, actual ${money(DEMO_INTELLIGENCE.forecast!.actual)}, variance ${money(DEMO_INTELLIGENCE.forecast!.actual - DEMO_INTELLIGENCE.forecast!.forecast)}\n- What moves the number: ${DEMO_MOVERS.map(m => `${m.name} (${m.tag}) ${m.swing < 0 ? '-' : '+'}${money(Math.abs(m.swing))} at ${m.prob}% probability, ${m.note}`).join('; ')}`)

  const I = DEMO_INTELLIGENCE
  out.push(`\n# Revenue intelligence (last 30 days)\n- Revenue protected by Popsicle: ${money(I.hero!.protectedTotal)} saved this quarter · ${I.hero!.caughtEarly} signals caught early · ${I.hero!.recovered} deals recovered · ${I.hero!.fasterDays}d average response improvement\n- Performance: risk change +${I.performance!.riskChangePct}% · success rate ${I.performance!.successRatePct}% (target ${I.successTarget}%) · stabilized ${money(I.performance!.stabilized)}\n- This week's story: ${I.bullets.map(b => `${b.lead}${b.rest}`).join(' | ')} · chips: ${I.storyChips!.join(', ')}\n- New risk added week ${I.weekNo}: ${money(I.newRisk)} (▲ +${I.riskDeltaPct}% vs W1 ${money(I.firstWeekRisk)}) · stabilized this period ${money(I.stabilized)} · net risk change +${I.netChangePct}%\n- Weekly at-risk series: ${I.weeks.map(w => `${w.label} ${money(w.added)}`).join(', ')}\n- Key movement drivers: ${I.drivers.map(d => `${d.k} ${d.v < 0 ? '+' : ''}${money(Math.abs(d.v))}${d.v < 0 ? ' (stabilized)' : ''}`).join(', ')}\n- Where the risk sits (by driver): ${I.riskSits.map(r => `${r.k} ${r.pct}% (${money(r.exposure)} exposure)`).join(', ')}\n- By segment: ${I.bySegment!.map(s => `${s.k} ${money(s.v)}`).join(', ')} · exposure trend ${money(I.exposureTrend!.total)} total, +${money(I.exposureTrend!.vsPrior)} vs prior period, peak ${I.exposureTrend!.peak}, trajectory ${I.exposureTrend!.trajectory}\n- Churn probability distribution: ${I.byHealth!.map(h => `${h.k} ${h.n}`).join(', ')}\n- Intervention effectiveness (action → used → success → avg churn Δ): ${I.actions.map(a => `${a.k} ${a.used} used, ${a.success}% success, ${a.churn}%`).join('; ')}. ${I.insight}\n- Signal sources: ${I.sources.map(s => `${s.k} ${s.n} (${Math.round(s.n / 847 * 100)}%)`).join(', ')} · 847 signals · ${I.sources.length} active sources\n- Renewal outlook next 90 days (${money(I.renewals.reduce((a, r) => a + r.value, 0))} in window): ${I.renewals.map(r => `${r.account} in ${r.days} days, ${money(r.value)}, ${r.status}`).join('; ')}`)

  const T = DEMO_TEAM
  out.push(`\n# Team intelligence\n- Total exposure ${money(T.exposure!.total)} · stabilized this week ${money(T.exposure!.stabilizedThisWeek)} · median time-to-action ${T.timeToAction}h · signal coverage ${T.coveragePct}% · AI confidence ${T.exposure!.aiConfidence}% · updated ${T.exposure!.updated}\n- Popsicle Saves Q4 2026 (team total ${money(T.protectedTotal)} protected, ▲ +${T.protectedDeltaPct}% vs Q3): ${T.reps.map((r, i) => `#${i + 1} ${r.name} (${r.title}) ${r.signals} signals caught, ${r.saved} deals recovered, ${money(r.protectedValue)} protected`).join('; ')}\n- Coverage & ownership: critical coverage ${T.criticalOwned} owned · ${T.activeFollowUp} with active follow-up · ${T.unowned!.count} unowned · unowned risk ${money(T.unowned!.risk)} · ${T.unowned!.stale} stale accounts. ${T.reps.map(r => `${r.name}: ${r.accounts.length} accounts (${r.accounts.join(', ')}), ${money(r.exposure!)} exposure, ${r.ownership === 'active' ? 'Active' : r.ownershipNote}`).join('; ')}\n- Stabilization efficiency (last 7 days): ${T.reps.map(r => `${r.name} improved ${r.improvedAccts} accts, churn Δ ${r.churnDelta}%, follow-thru ${r.followThrough}%, ${money(r.stabilized!)} stabilized`).join('; ')}\n- Revenue actions feed (${T.actionsTaken} actions, last 7 days): ${T.actionsFeed!.map(a => `${a.rep} on ${a.account}: ${a.action} (${a.driver} ${a.from}% → ${a.to}%, +${money(a.recovered)})`).join('; ')}\n- Execution quality: time-to-action ${T.timeToAction}h · follow-through ${T.followThrough}% · loop closure ${T.loopClosure}%. Per rep: ${T.reps.map(r => `${r.name} T2A ${r.avgResp}h, F/T ${r.followThrough}%, closure ${r.closure}%`).join('; ')}. ${T.executionInsight}\n- Unactioned signal queue (${T.queue.length} of ${T.signalsThisWeek} this week, ${money(T.waitingValue)} ARR waiting, ${T.unresolvedPct}% unresolved): ${T.queue.map(q => `${q.account} [${q.sev}] ${q.summary}, ${q.age} unactioned, owner ${q.rep}`).join('; ')}\n- Revenue movement this week: new critical +${T.newCritical} · accounts stabilized +${T.stabilized} · actions taken ${T.actionsTaken} · signals per day ${T.signalsPerDay} (▲ ${T.signalsPerDayDelta})`)

  out.push(`\n# Integrations\n- ${DEMO_INTEGRATION_ACTIVE.length} sources connected: ${DEMO_INTEGRATION_ACTIVE.map(k => `${k} (${DEMO_INTEGRATION_STATS[k].thisMonth} signals in 30 days, ${DEMO_INTEGRATION_STATS[k].total} all time, identity ${DEMO_INTEGRATION_STATS[k].identity})`).join('; ')}\n- Unconnected: Outlook, Microsoft Teams, Google Calendar & Meet, HubSpot, Salesforce, Gong, Fireflies`)

  out.push(`\n# Accounts (${DEMO_ACCOUNTS.length} active)`)
  for (const a of DEMO_ACCOUNTS) out.push('\n' + accountBlock(a))

  const tr = DEMO_TRANSCRIPT
  out.push(`\n# Call transcript · ${tr.account} · ${tr.title} (${tr.duration} min, ${tr.when}, ${tr.analyser})\n- AI summary: ${tr.summary}\n- Key moments:\n${tr.moments.map(m => `  - ${m.t} ${m.tag ? `[${m.tag}] ` : ''}${m.who}: ${m.text}`).join('\n')}`)

  return out.join('\n')
}

export const DEMO_AI_CONTEXT = build()
