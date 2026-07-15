import '@/app/globals.css'
import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui/toast'
import { AppInitializer } from '@/components/app-initializer'

export const metadata: Metadata = {
  title: 'BritLedger AI - Modern Bookkeeping & Invoicing',
  description: 'AI-powered bookkeeping and invoicing for modern businesses.',
  icons: { icon: '/icon.png' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <ToastProvider>
          <AppInitializer>
            {children}
          </AppInitializer>
        </ToastProvider>
      </body>
    </html>
  )
}

