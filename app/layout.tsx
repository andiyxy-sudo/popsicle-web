import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Popsicle - Revenue Intelligence',
  description: 'Revenue + Cost + Activity to Decisions',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the chosen theme before anything is drawn, so a page never flashes light first */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('theme')||'Light';var d=t==='Dark'||(t==='Match system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
