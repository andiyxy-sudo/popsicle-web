import { createClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/data'
import { TeamShowcase } from './TeamShowcase'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data) return null
  const email = data.claims.email as string | undefined

  if (email === DEMO_EMAIL) {
    return <TeamShowcase />
  }

  // Real users: team intelligence requires multiple seats/reps.
  return (
    <div className="dsk-screen on">
      <div className="page-hdr"><h1>Team Intelligence</h1><p>Execution intelligence across live revenue signals</p></div>
      <div className="dcard" style={{ textAlign: 'center', padding: '56px 24px' }}>
        <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 6 }}>Team view unlocks with multiple seats.</div>
        <div style={{ fontSize: 13, color: 'var(--t4)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>Invite teammates to see the leaderboard, per-rep response times, activity heat maps, and the unactioned signal queue across your team.</div>
      </div>
    </div>
  )
}
