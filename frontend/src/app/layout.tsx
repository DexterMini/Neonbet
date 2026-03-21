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
            {/* Casino ambient background — dramatic neon glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
              {/* Top-left green neon wash */}
              <div className="absolute -top-[30%] -left-[15%] w-[50%] h-[50%] bg-brand/[0.04] rounded-full blur-[180px]" />
              {/* Bottom-right purple neon wash */}
              <div className="absolute -bottom-[20%] -right-[15%] w-[45%] h-[45%] bg-purple-500/[0.025] rounded-full blur-[160px]" />
              {/* Center golden accent */}
              <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-[30%] h-[20%] bg-amber-500/[0.015] rounded-full blur-[140px]" />
              {/* subtle noise overlay for depth */}
              <div className="absolute inset-0 opacity-[0.012]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }} />
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
