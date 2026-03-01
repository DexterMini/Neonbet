'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Menu, Bell, User, LogOut, Settings, X, Wallet, ChevronDown, Zap, MessageCircle } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/Dropdown'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'

declare global {
  interface Window {
    ethereum?: any
  }
}

const USD_PRICES: Record<string, number> = {
  btc: 46800, eth: 3200, ltc: 70, usdt: 1, usdc: 1, sol: 150,
}

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, token, isAuthenticated, isHydrated, logout } = useAuthStore()
  const { toggle: toggleChat, isOpen: chatOpen, onlineCount } = useChatStore()
  const [wallet, setWallet] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [totalUsd, setTotalUsd] = useState(0)

  const fetchBalance = useCallback(async () => {
    if (!token) { setTotalUsd(0); return }
    try {
      const res = await fetch('/api/v1/wallet/balances', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      const sum = (data.balances ?? []).reduce((acc: number, b: any) => {
        const price = USD_PRICES[(b.currency || '').toLowerCase()] || 0
        return acc + parseFloat(b.available || '0') * price
      }, 0)
      setTotalUsd(sum)
    } catch { /* ignore */ }
  }, [token])

  useEffect(() => {
    const savedWallet = localStorage.getItem('wallet')
    if (savedWallet) setWallet(savedWallet)
  }, [])

  useEffect(() => {
    if (isHydrated && isAuthenticated) fetchBalance()
  }, [isHydrated, isAuthenticated, fetchBalance])

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or another Web3 wallet')
      return
    }
    setConnecting(true)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (accounts[0]) {
        setWallet(accounts[0])
        localStorage.setItem('wallet', accounts[0])
      }
    } catch (err) {
      console.error('Wallet connection failed:', err)
    }
    setConnecting(false)
  }

  const disconnectWallet = () => {
    setWallet(null)
    localStorage.removeItem('wallet')
  }

  const handleLogout = () => {
    logout()
    disconnectWallet()
    router.push('/')
  }

  const formatWallet = (addr: string) => addr.slice(0, 6) + '...' + addr.slice(-4)

  const displayName = user?.username || (wallet ? formatWallet(wallet) : null)
  const initials = user?.username?.slice(0, 2).toUpperCase() || wallet?.slice(2, 4).toUpperCase() || '??'
  const isLoggedIn = isHydrated && (isAuthenticated || !!wallet || !!user)

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/60">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left */}
        <div className="flex items-center gap-2">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 rounded-lg text-muted hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile Logo */}
          <Link href="/" className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-background-deep" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-white text-sm">NeonBet</span>
          </Link>

          {/* Desktop nav tabs */}
          <div className="hidden md:flex items-center gap-1 ml-1">
            <Link href="/" className={cn(
              'px-4 py-1.5 text-[13px] font-semibold rounded-lg border transition-colors',
              pathname === '/' || pathname.startsWith('/games')
                ? 'text-brand bg-brand/10 border-brand/20'
                : 'text-muted-light hover:text-white border-transparent hover:bg-white/[0.04]'
            )}>
              Casino
            </Link>
          </div>
        </div>

        {/* Center — Search */}
        <div className="hidden md:block flex-1 max-w-md mx-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 transition-all"
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Chat toggle */}
          <button
            onClick={toggleChat}
            className={cn(
              'relative p-2 rounded-lg transition-colors',
              chatOpen
                ? 'bg-brand/10 text-brand'
                : 'text-muted hover:text-white hover:bg-white/[0.04]'
            )}
            title="Toggle Chat"
          >
            <MessageCircle className="w-[18px] h-[18px]" />
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold bg-brand text-background-deep rounded-full">
              {onlineCount > 999 ? `${(onlineCount / 1000).toFixed(1)}k` : onlineCount}
            </span>
          </button>

          {/* Mobile search toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="md:hidden p-2 rounded-lg text-muted hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {isLoggedIn ? (
            <>
              {/* Balance pill */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface rounded-lg border border-border">
                <Wallet className="w-3.5 h-3.5 text-brand" />
                <span className="text-brand text-[13px] font-mono font-semibold tabular-nums">{formatCurrency(totalUsd)}</span>
              </div>

              {/* Notifications */}
              <button className="relative p-2 rounded-lg text-muted hover:text-white hover:bg-white/[0.04] transition-colors">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent-red rounded-full" />
              </button>

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-background-deep text-xs font-bold">
                      {initials}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-muted hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="text-2xs text-muted">{user ? 'Account' : 'Wallet'}</p>
                    <p className="text-small text-white font-mono truncate mt-0.5">{user?.email || wallet || ''}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <User className="w-4 h-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/wallet')}>
                    <Wallet className="w-4 h-4" /> Wallet
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/vip')}>
                    <Zap className="w-4 h-4" /> VIP Club
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onClick={handleLogout}>
                    <LogOut className="w-4 h-4" /> {isAuthenticated ? 'Sign Out' : 'Disconnect'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-[13px]">
                  Log In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="text-[13px] font-semibold shadow-glow-brand-sm">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile Search */}
      {showSearch && (
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search games..."
              autoFocus
              className="w-full pl-9 pr-10 py-2.5 bg-surface border border-border rounded-lg text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-brand/40 transition-all"
            />
            <button
              onClick={() => setShowSearch(false)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
