import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { IntelligenceShowcase } from './IntelligenceShowcase'

export default async function IntelligencePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const email = data.claims.email as string | undefined

  if (email === DEMO_EMAIL) {
    return <IntelligenceShowcase />
  }

  // Real users: intelligence requires accumulated signal history.
  return (
    <div className="dsk-screen on">
      <div className="page-hdr"><h1>Revenue Intelligence</h1><p>Historical and predictive analysis across revenue signals</p></div>
      <div className="dcard" style={{ textAlign: 'center', padding: '56px 24px' }}>
        <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 6 }}>Not enough signal history yet.</div>
        <div style={{ fontSize: 13, color: 'var(--t4)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>Revenue intelligence builds over time as Popsicle tracks signals and interventions across your accounts. Check back after a few weeks of activity.</div>
      </div>
    </div>
  )
}
