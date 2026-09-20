import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TranscriptViewer } from '@/components/transcripts/TranscriptViewer'
import { orgIdsServer } from '@/lib/org'

// Full call transcript viewer. Reached from call signals ("View full
// transcript") using the meeting uuid carried in source_message_id.
export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const uuid = decodeURIComponent(id)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: row } = await supabase
    .from('zoom_transcripts')
    .select('*')
    .in('user_id', await orgIdsServer(supabase, user.id))
    .eq('meeting_uuid', uuid)
    .maybeSingle()

  return <TranscriptViewer row={row} userEmail={user.email ?? ''} />
}
