'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  X, Home, Star, Clock, Zap, Gamepad2, Tv, Spade,
  Gift, Crown, Wallet, MessageCircle, ChevronRight,
  Flame, Trophy, TrendingUp, Bomb, Dices, CircleDot,
  Target, RotateCcw, Grid3X3, Layers, Gem, Bird,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Navigation items ───────────────────────────────── */
const mainNav = [
  { name: 'Lobby', href: '/', icon: Home },
  { name: 'Favourites', href: '/favourites', icon: Star },
  { name: 'Recently Played', href: '/recents', icon: Clock },
]

const gameCategories = [
  { name: 'Originals', href: '/', icon: Zap, color: 'text-brand' },
  { name: 'Slots', href: '#slots', icon: Gamepad2, color: 'text-accent-purple' },
  { name: 'Live Casino', href: '#live', icon: Tv, color: 'text-accent-red' },
  { name: 'Game Shows', href: '#shows', icon: Flame, color: 'text-accent-amber' },
  { name: 'Table Games', href: '#tables', icon: Spade, color: 'text-accent-blue' },
]

const originalGames = [
  { id: 'crash', name: 'Crash', href: '/games/crash', icon: TrendingUp, color: 'text-emerald-400', hot: true },
  { id: 'dice', name: 'Dice', href: '/games/dice', icon: Dices, color: 'text-red-400' },
  { id: 'mines', name: 'Mines', href: '/games/mines', icon: Bomb, color: 'text-cyan-400', hot: true },
  { id: 'plinko', name: 'Plinko', href: '/games/plinko', icon: CircleDot, color: 'text-violet-400' },
  { id: 'limbo', name: 'Limbo', href: '/games/limbo', icon: Target, color: 'text-sky-400' },
  { id: 'wheel', name: 'Wheel', href: '/games/wheel', icon: RotateCcw, color: 'text-amber-400' },
  { id: 'keno', name: 'Keno', href: '/games/keno', icon: Grid3X3, color: 'text-green-400' },
  { id: 'twentyone', name: 'Twenty One', href: '/games/twentyone', icon: Spade, color: 'text-fuchsia-400' },
  { id: 'coinclimber', name: 'Coin Climber', href: '/games/coinclimber', icon: Layers, color: 'text-yellow-400', isNew: true },
  { id: 'snake', name: 'Snake', href: '/games/snake', icon: Gem, color: 'text-lime-400', isNew: true },
  { id: 'chicken', name: 'Chicken Road', href: '/games/chicken', icon: Bird, color: 'text-orange-400', isNew: true },
]

const bottomNav = [
  { name: 'Promotions', href: '/promotions', icon: Gift, badge: 3 },
  { name: 'VIP Club', href: '/vip', icon: Crown },
  { name: 'Wallet', href: '/wallet', icon: Wallet },
]

/* ── Component ───────────────────────────────────────── */
interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [showGames, setShowGames] = useState(true)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (onClose) onClose() }, [pathname])

  const isActive = (href: string) => pathname === href

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border/60">
        <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center shadow-glow-brand-sm">
            <Zap className="w-4.5 h-4.5 text-background-deep" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-white tracking-tight text-[15px]">NeonBet</span>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-white/[0.04] text-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-2.5 space-y-1">
        {/* Main nav */}
        <div className="space-y-0.5">
          {mainNav.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group',
                  active
                    ? 'bg-brand/10 text-brand'
                    : 'text-muted-light hover:text-white hover:bg-white/[0.04]'
                )}
              >
                <Icon className={cn('w-[18px] h-[18px]', active ? 'text-brand' : 'text-muted group-hover:text-white')} />
                <span className="text-[13px] font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60 mx-2 my-2" />

        {/* Casino categories header */}
        <div className="px-3 py-1.5">
          <span className="text-[10px] font-bold text-muted uppercase tracking-[0.15em]">Casino</span>
        </div>

        {/* Category items */}
        <div className="space-y-0.5">
          {gameCategories.map((cat) => {
            const Icon = cat.icon
            return (
              <Link
                key={cat.name}
                href={cat.href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-light hover:text-white hover:bg-white/[0.04] transition-all duration-150 group"
              >
                <Icon className={cn('w-[18px] h-[18px]', cat.color)} />
                <span className="text-[13px] font-medium flex-1">{cat.name}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )
          })}
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60 mx-2 my-2" />

        {/* Originals games list */}
        <div>
          <button
            onClick={() => setShowGames(!showGames)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
          >
            <Zap className="w-3.5 h-3.5 text-brand" />
            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.15em] flex-1">Originals</span>
            <ChevronRight className={cn(
              'w-3 h-3 text-muted transition-transform duration-200',
              showGames && 'rotate-90'
            )} />
          </button>

          <div className={cn(
            'overflow-hidden transition-all duration-200',
            showGames ? 'max-h-[500px] opacity-100 mt-0.5' : 'max-h-0 opacity-0'
          )}>
            <div className="space-y-0.5 pl-1">
              {originalGames.map((game) => {
                const active = isActive(game.href)
                return (
                  <Link
                    key={game.id}
                    href={game.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all duration-150 group',
                      active
                        ? 'bg-brand/10 text-white'
                        : 'text-muted-light hover:text-white hover:bg-white/[0.04]'
                    )}
                  >
                    <game.icon className={cn('w-4 h-4', game.color)} />
                    <span className="text-[13px] font-medium flex-1">{game.name}</span>
                    {game.hot && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-accent-red/15 text-accent-red rounded border border-accent-red/20 uppercase">
                        Hot
                      </span>
                    )}
                    {game.isNew && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-brand/15 text-brand rounded border border-brand/20 uppercase">
                        New
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60 mx-2 my-2" />

        {/* Promotions / VIP / Wallet */}
        <div className="space-y-0.5">
          {bottomNav.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group',
                  active
                    ? 'bg-brand/10 text-brand'
                    : 'text-muted-light hover:text-white hover:bg-white/[0.04]'
                )}
              >
                <Icon className={cn('w-[18px] h-[18px]', active ? 'text-brand' : 'text-muted group-hover:text-white')} />
                <span className="text-[13px] font-medium flex-1">{item.name}</span>
                {item.badge && (
                  <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-brand text-background-deep rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Promo card */}
        <div className="mx-1 mt-3 p-3 rounded-xl bg-gradient-to-br from-brand/10 via-brand/5 to-transparent border border-brand/10">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-brand" />
            <span className="text-[11px] font-bold text-brand uppercase tracking-wider">Daily Race</span>
          </div>
          <p className="text-[11px] text-muted-light leading-relaxed mb-2">
            $10,000 prize pool. Wager to climb the leaderboard.
          </p>
          <div className="text-[18px] font-bold text-white font-mono">$10,000</div>
        </div>
      </nav>

      {/* Support */}
      <div className="p-2.5 border-t border-border/60">
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-light hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <MessageCircle className="w-[18px] h-[18px] text-muted" />
          <span className="text-[13px] font-medium">Live Support</span>
        </a>
        <div className="mt-2 px-3 py-2 text-center">
          <span className="text-[10px] font-black tracking-[0.15em] text-brand/40 uppercase select-none">ONLyATneonBET</span>
          <div className="text-[8px] text-white/10 font-mono mt-0.5">v1.0.0 &bull; demo</div>
        </div>
      </div>
    </>
  )

  if (!mounted) return null

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[220px] h-screen bg-background-secondary/80 border-r border-border/60 flex-col shrink-0 sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-background-secondary flex flex-col shadow-soft-xl animate-slide-in-left">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
