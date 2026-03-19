import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Toaster } from 'sonner'
import AchievementToast from '@/components/AchievementToast'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})

export const viewport: Viewport = {
  themeColor: '#0A0B0F',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: {
    default: 'NeonBet | Provably Fair Casino',
    template: '%s | NeonBet'
  },
  description: 'Experience the future of online gaming with provably fair casino games. Play Dice, Crash, Mines, Plinko and more with instant payouts.',
  keywords: ['casino', 'provably fair', 'gambling', 'crash game', 'dice game'],
  authors: [{ name: 'NeonBet' }],
  creator: 'NeonBet',
  robots: 'index, follow',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="bg-background text-white antialiased min-h-screen overflow-x-hidden font-sans">
        <Providers>
          <div className="relative">
            {/* Ambient background — subtle warm glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] bg-brand/[0.015] rounded-full blur-[150px]" />
              <div className="absolute -bottom-[30%] -right-[20%] w-[50%] h-[50%] bg-brand/[0.01] rounded-full blur-[120px]" />
            </div>
            
            {/* Main content */}
            <div className="relative z-10">
              {children}
            </div>
          </div>
          
          <AchievementToast />
          <Toaster 
            theme="dark"
            position="bottom-right"
            expand={false}
            richColors
            toastOptions={{
              style: {
                background: '#141620',
                border: '1px solid #1A1D28',
                color: '#E8EAF0',
                borderRadius: '12px',
                fontSize: '13px',
              },
              className: 'shadow-soft-lg',
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
