'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Menu, Bell, User, LogOut, Settings, X, Wallet, ChevronDown, Zap, MessageCircle, Copy, Check, ArrowDown, ArrowUp, ExternalLink } from 'lucide-react'
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
import { QRCodeSVG } from 'qrcode.react'
import { AnimatePresence, motion } from 'framer-motion'

declare global {
  interface Window {
    ethereum?: any
  }
}

const USD_PRICES: Record<string, number> = {
  btc: 46800, eth: 3200, ltc: 70, usdt: 1, usdc: 1, sol: 150,
}

const CRYPTO_META: { symbol: string; name: string; icon: string; color: string; address: string }[] = [
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿', color: 'text-orange-400', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', color: 'text-blue-400', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' },
  { symbol: 'SOL', name: 'Solana', icon: '◎', color: 'text-purple-400', address: 'DRpbCBMxVnDK7maPMoGQfFkKMkb6eq8UGNJJg4dU3vKL' },
  { symbol: 'USDT', name: 'Tether', icon: '₮', color: 'text-emerald-400', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' },
  { symbol: 'USDC', name: 'USD Coin', icon: '$', color: 'text-blue-300', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' },
  { symbol: 'LTC', name: 'Litecoin', icon: 'Ł', color: 'text-gray-300', address: 'ltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
]

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
  const [walletOpen, setWalletOpen] = useState(false)
  const [selectedCrypto, setSelectedCrypto] = useState(0)
  const [copied, setCopied] = useState(false)
  const [walletTab, setWalletTab] = useState<'deposit' | 'withdraw'>('deposit')
  const walletRef = useRef<HTMLDivElement>(null)

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

  // Close wallet dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setWalletOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const copyAddress = () => {
    const addr = CRYPTO_META[selectedCrypto]?.address || ''
    if (!addr) return
    navigator.clipboard.writeText(addr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
            <Link href="/sports" className={cn(
              'px-4 py-1.5 text-[13px] font-semibold rounded-lg border transition-colors',
              pathname === '/sports'
                ? 'text-brand bg-brand/10 border-brand/20'
                : 'text-muted-light hover:text-white border-transparent hover:bg-white/[0.04]'
            )}>
              Sports
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
            {onlineCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold bg-brand text-background-deep rounded-full">
                {onlineCount}
              </span>
            )}
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
              {/* Balance pill → opens Wallet dropdown */}
              <div className="relative hidden sm:block" ref={walletRef}>
                <button
                  onClick={() => setWalletOpen(!walletOpen)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all',
                    walletOpen
                      ? 'bg-brand/10 border-brand/40 ring-1 ring-brand/20'
                      : 'bg-surface border-border hover:border-brand/30'
                  )}
                >
                  <Wallet className="w-3.5 h-3.5 text-brand" />
                  <span className="text-brand text-[13px] font-mono font-semibold tabular-nums">{formatCurrency(totalUsd)}</span>
                  <ChevronDown className={cn('w-3 h-3 text-muted transition-transform', walletOpen && 'rotate-180')} />
                </button>

                {/* Wallet Dropdown Panel */}
                <AnimatePresence>
                  {walletOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-[380px] bg-surface rounded-xl border border-border shadow-2xl z-50 overflow-hidden"
                    >
                      {/* Tabs */}
                      <div className="flex border-b border-border">
                        <button
                          onClick={() => setWalletTab('deposit')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all',
                            walletTab === 'deposit' ? 'text-brand border-b-2 border-brand bg-brand/5' : 'text-muted hover:text-white'
                          )}
                        >
                          <ArrowDown size={14} /> Deposit
                        </button>
                        <button
                          onClick={() => setWalletTab('withdraw')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all',
                            walletTab === 'withdraw' ? 'text-brand border-b-2 border-brand bg-brand/5' : 'text-muted hover:text-white'
                          )}
                        >
                          <ArrowUp size={14} /> Withdraw
                        </button>
                      </div>

                      {walletTab === 'deposit' ? (
                        <div className="p-4 space-y-4">
                          {/* Crypto selector pills */}
                          <div>
                            <label className="text-[10px] text-muted uppercase tracking-wider font-bold mb-2 block">Select Currency</label>
                            <div className="grid grid-cols-3 gap-1.5">
                              {CRYPTO_META.map((c, i) => (
                                <button
                                  key={c.symbol}
                                  onClick={() => { setSelectedCrypto(i); setCopied(false) }}
                                  className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                                    selectedCrypto === i
                                      ? 'bg-brand/15 border border-brand/40 text-white'
                                      : 'bg-background border border-border text-muted hover:text-white hover:border-brand/30'
                                  )}
                                >
                                  <span className={cn('text-sm', c.color)}>{c.icon}</span>
                                  <span>{c.symbol}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* QR Code */}
                          <div className="flex flex-col items-center gap-3">
                            <div className="bg-white p-3 rounded-xl">
                              <QRCodeSVG
                                value={CRYPTO_META[selectedCrypto]?.address || 'neonbet'}
                                size={140}
                                bgColor="#ffffff"
                                fgColor="#000000"
                                level="H"
                                includeMargin={false}
                              />
                            </div>
                            <span className="text-[10px] text-muted">
                              Scan to deposit {CRYPTO_META[selectedCrypto]?.name}
                            </span>
                          </div>

                          {/* Address */}
                          <div>
                            <label className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1.5 block">
                              {CRYPTO_META[selectedCrypto]?.name} Address
                            </label>
                            <div className="flex items-center gap-2 bg-background rounded-lg border border-border p-2.5">
                              <span className="flex-1 text-[11px] text-white font-mono truncate">
                                {CRYPTO_META[selectedCrypto]?.address}
                              </span>
                              <button onClick={copyAddress}
                                className="shrink-0 p-1.5 rounded bg-brand/10 hover:bg-brand/20 text-brand transition-colors"
                              >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>

                          {/* Network info */}
                          <div className="bg-background/50 rounded-lg p-2.5 text-[10px] text-muted space-y-1">
                            <div className="flex justify-between">
                              <span>Network</span>
                              <span className="text-white font-semibold">
                                {CRYPTO_META[selectedCrypto]?.symbol === 'BTC' ? 'Bitcoin' :
                                 CRYPTO_META[selectedCrypto]?.symbol === 'SOL' ? 'Solana' :
                                 CRYPTO_META[selectedCrypto]?.symbol === 'LTC' ? 'Litecoin' : 'ERC-20'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Min Deposit</span>
                              <span className="text-white font-semibold">
                                {CRYPTO_META[selectedCrypto]?.symbol === 'BTC' ? '0.0001 BTC' :
                                 CRYPTO_META[selectedCrypto]?.symbol === 'ETH' ? '0.001 ETH' :
                                 CRYPTO_META[selectedCrypto]?.symbol === 'SOL' ? '0.01 SOL' : '1 ' + CRYPTO_META[selectedCrypto]?.symbol}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Confirmations</span>
                              <span className="text-white font-semibold">
                                {CRYPTO_META[selectedCrypto]?.symbol === 'BTC' ? '2' :
                                 CRYPTO_META[selectedCrypto]?.symbol === 'SOL' ? '1' : '12'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 relative">
                          <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-b-xl">
                            <ArrowUp size={24} className="text-muted mb-2 opacity-40" />
                            <span className="text-sm font-bold text-white">Coming Soon</span>
                            <span className="text-[11px] text-muted mt-1">Withdrawals launching soon</span>
                          </div>
                          <div className="opacity-30 pointer-events-none space-y-3 py-4">
                            <div className="h-10 bg-background rounded-lg" />
                            <div className="h-10 bg-background rounded-lg" />
                            <div className="h-10 bg-background rounded-lg" />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
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
