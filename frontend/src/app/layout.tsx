import '@/app/globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ToastProvider } from '@/components/ui/toast'
import { AppInitializer } from '@/components/app-initializer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

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
      </head>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <ToastProvider>
          <AppInitializer>
            {children}
          </AppInitializer>
        </ToastProvider>
      </body>
    </html>
  )
}

