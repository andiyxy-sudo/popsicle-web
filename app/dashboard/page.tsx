import { redirect } from 'next/navigation'

// Legacy route: the dashboard moved to /pulse. Kept so old links and any
// cached redirect never land on an empty screen.
export default function DashboardPage() {
  redirect('/pulse')
}
