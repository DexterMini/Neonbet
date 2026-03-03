'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Gamepad2, Trophy, Wallet, MessageCircle, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'

const navItems = [
  { href: '/', label: 'Lobby', icon: Home, match: (p: string) => p === '/' },
  { href: '/games/crash', label: 'Games', icon: Gamepad2, match: (p: string) => p.startsWith('/games') },
  { href: '/sports', label: 'Sports', icon: Trophy, match: (p: string) => p === '/sports' },
  { href: '/wallet', label: 'Wallet', icon: Wallet, match: (p: string) => p === '/wallet' },
]

export function MobileNav() {
  const pathname = usePathname()
  const { toggle: toggleChat, isOpen: chatOpen, onlineCount } = useChatStore()

  // Hide on admin pages
  if (pathname.startsWith('/admin')) return null

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/60 safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map(item => {
          const Icon = item.icon
          const active = item.match(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-colors',
                active ? 'text-brand' : 'text-muted hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
        {/* Chat toggle */}
        <button
          onClick={toggleChat}
          className={cn(
            'relative flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-colors',
            chatOpen ? 'text-brand' : 'text-muted hover:text-white'
          )}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-[10px] font-medium">Chat</span>
          {onlineCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-1 flex items-center justify-center text-[8px] font-bold bg-brand text-background-deep rounded-full">
              {onlineCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  )
}
