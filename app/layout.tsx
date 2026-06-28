import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Popsicle - Revenue Intelligence',
  description: 'Revenue + Cost + Activity → Decisions',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
