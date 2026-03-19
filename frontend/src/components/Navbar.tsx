'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Menu, Bell, User, LogOut, Settings, X, Wallet, ChevronDown, Zap, MessageCircle, ArrowDown, ArrowUp } from 'lucide-react'
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
import { useNotificationStore, startNotificationSimulation, type NotificationType } from '@/stores/notificationStore'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'

declare global {
  interface Window {
    ethereum?: any
  }
}

const USD_PRICES: Record<string, number> = {
  btc: 46800, eth: 3200, ltc: 70, usdt: 1, usdc: 1, sol: 150,
}

const CRYPTO_META: { symbol: string; name: string; icon: string; color: string; address: string; network: string; minDeposit: string }[] = [
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿', color: 'text-orange-400', address: '', network: 'Bitcoin', minDeposit: '0.0001 BTC' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', color: 'text-blue-400', address: '', network: 'ERC-20', minDeposit: '0.001 ETH' },
  { symbol: 'SOL', name: 'Solana', icon: '◎', color: 'text-purple-400', address: '', network: 'Solana', minDeposit: '0.01 SOL' },
  { symbol: 'USDT', name: 'Tether', icon: '₮', color: 'text-emerald-400', address: '', network: 'TRC-20', minDeposit: '10 USDT' },
  { symbol: 'USDC', name: 'USD Coin', icon: '$', color: 'text-blue-300', address: '', network: 'ERC-20', minDeposit: '10 USDC' },
  { symbol: 'LTC', name: 'Litecoin', icon: 'Ł', color: 'text-gray-300', address: '', network: 'Litecoin', minDeposit: '0.01 LTC' },
]

// ── Notification styling per type ──
const NOTIF_STYLES: Record<NotificationType, { bg: string; emoji: string }> = {
  welcome: { bg: 'bg-brand/10', emoji: '⚡' },
  win:     { bg: 'bg-brand/10', emoji: '🎉' },
  deposit: { bg: 'bg-blue-500/10', emoji: '💰' },
  withdraw:{ bg: 'bg-amber-500/10', emoji: '📤' },
  vip:     { bg: 'bg-accent-purple/10', emoji: '👑' },
  promo:   { bg: 'bg-amber-500/10', emoji: '🔥' },
  game:    { bg: 'bg-accent-purple/10', emoji: '🎮' },
  system:  { bg: 'bg-white/5', emoji: '🔔' },
  bonus:   { bg: 'bg-brand/10', emoji: '🎁' },
  cashback:{ bg: 'bg-emerald-500/10', emoji: '💸' },
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, token, isAuthenticated, isHydrated, logout, setUser } = useAuthStore()
  const { toggle: toggleChat, isOpen: chatOpen, onlineCount } = useChatStore()
  const { notifications, unreadCount: notifUnread, markAsRead, markAllAsRead, clearAll } = useNotificationStore()
  const [wallet, setWallet] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [totalUsd, setTotalUsd] = useState(0)
  const [walletOpen, setWalletOpen] = useState(false)
  const [selectedCrypto, setSelectedCrypto] = useState(0)
  const [walletTab, setWalletTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositLoading, setDepositLoading] = useState(false)
  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [depositStatus, setDepositStatus] = useState<'idle' | 'waiting' | 'confirming' | 'done'>('idle')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
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
    startNotificationSimulation()
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

  const createDeposit = async () => {
    const amount = parseFloat(depositAmount)
    if (!amount || amount < 1) {
      toast.error('Minimum deposit is $1')
      return
    }
    setDepositLoading(true)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || ''
      const res = await fetch(`${apiBase}/api/v1/payments/deposit/invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount_usd: amount,
          currency: CRYPTO_META[selectedCrypto].symbol,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || 'Failed to create deposit')
      }
      const data = await res.json()
      if (!data.invoice_url) {
        throw new Error('Payment provider did not return an invoice URL')
      }
      setInvoiceUrl(data.invoice_url)
      setDepositStatus('waiting')
      window.open(data.invoice_url, '_blank')
      toast.success('Payment page opened in new tab')
    } catch (e: any) {
      toast.error(e.message || 'Deposit failed')
    }
    setDepositLoading(false)
  }

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!withdrawAddress || withdrawAddress.length < 20) {
      toast.error('Enter a valid wallet address')
      return
    }
    setWithdrawLoading(true)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || ''
      const res = await fetch(`${apiBase}/api/v1/wallet/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `wd_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currency: CRYPTO_META[selectedCrypto].symbol,
          amount,
          address: withdrawAddress,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || 'Withdrawal failed')
      }
      const data = await res.json()
      toast.success(`Withdrawal of ${amount} ${CRYPTO_META[selectedCrypto].symbol} submitted`)
      setWithdrawAmount('')
      setWithdrawAddress('')
      fetchBalance()
    } catch (e: any) {
      toast.error(e.message || 'Withdrawal failed')
    }
    setWithdrawLoading(false)
  }

  const resetDepositState = () => {
    setInvoiceUrl('')
    setDepositStatus('idle')
    setDepositAmount('')
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
              <div className="relative" ref={walletRef}>
                <button
                  onClick={() => setWalletOpen(!walletOpen)}
                  className={cn(
                    'flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg border transition-all',
                    walletOpen
                      ? 'bg-brand/10 border-brand/40 ring-1 ring-brand/20'
                      : 'bg-surface border-border hover:border-brand/30'
                  )}
                >
                  <Wallet className="w-3.5 h-3.5 text-brand" />
                  <span className="text-brand text-[12px] sm:text-[13px] font-mono font-semibold tabular-nums">{formatCurrency(totalUsd)}</span>
                  <ChevronDown className={cn('w-3 h-3 text-muted transition-transform hidden sm:block', walletOpen && 'rotate-180')} />
                </button>

                {/* Wallet Dropdown Panel */}
                <AnimatePresence>
                  {walletOpen && (
                    <>
                    {/* Mobile backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                      onClick={() => setWalletOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="fixed sm:absolute inset-x-0 sm:inset-x-auto sm:right-0 bottom-0 sm:bottom-auto sm:top-full sm:mt-2 w-full sm:w-[380px] max-h-[85vh] sm:max-h-none overflow-y-auto bg-surface rounded-t-2xl sm:rounded-xl border border-border shadow-2xl z-50"
                    >
                      {/* Mobile drag handle */}
                      <div className="sm:hidden flex justify-center pt-3 pb-1">
                        <div className="w-10 h-1 rounded-full bg-white/20" />
                      </div>
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
                                  onClick={() => { setSelectedCrypto(i); resetDepositState() }}
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

                          {depositStatus === 'idle' ? (
                            <>
                              {/* Deposit amount input */}
                              <div>
                                <label className="text-[10px] text-muted uppercase tracking-wider font-bold mb-2 block">Deposit Amount (USD)</label>
                                <input
                                  type="number"
                                  value={depositAmount}
                                  onChange={(e) => setDepositAmount(e.target.value)}
                                  placeholder="0.00"
                                  min="1"
                                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-white text-lg font-mono placeholder:text-muted/30 focus:outline-none focus:border-brand/50 transition-all"
                                />
                                {/* Quick amounts */}
                                <div className="grid grid-cols-4 gap-1.5 mt-2">
                                  {['10', '25', '50', '100'].map((v) => (
                                    <button
                                      key={v}
                                      onClick={() => setDepositAmount(v)}
                                      className={cn(
                                        'py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                        depositAmount === v
                                          ? 'bg-brand/15 border-brand/40 text-brand'
                                          : 'bg-background border-border text-muted hover:text-white hover:border-brand/30'
                                      )}
                                    >
                                      ${v}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Deposit button */}
                              <button
                                onClick={createDeposit}
                                disabled={!depositAmount || depositLoading}
                                className={cn(
                                  'w-full py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2',
                                  depositAmount && !depositLoading
                                    ? 'bg-brand text-background-deep hover:brightness-110 shadow-glow-brand-sm'
                                    : 'bg-surface border border-border text-muted cursor-not-allowed'
                                )}
                              >
                                {depositLoading ? (
                                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Creating...</>
                                ) : (
                                  <><ArrowDown size={14} /> Deposit {CRYPTO_META[selectedCrypto]?.symbol}</>
                                )}
                              </button>

                              {/* Network info */}
                              <div className="bg-background/50 rounded-lg p-2.5 text-[10px] text-muted space-y-1">
                                <div className="flex justify-between">
                                  <span>Network</span>
                                  <span className="text-white font-semibold">{CRYPTO_META[selectedCrypto]?.network}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Min Deposit</span>
                                  <span className="text-white font-semibold">{CRYPTO_META[selectedCrypto]?.minDeposit}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Processor</span>
                                  <span className="text-brand font-semibold">NOWPayments</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Payment created — invoice flow */}
                              <div className="flex flex-col items-center gap-3">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                                  </span>
                                  <span className="text-amber-400 font-semibold">Awaiting payment...</span>
                                </div>
                                <div className="text-center">
                                  <p className="text-white font-bold font-mono text-lg">${depositAmount} USD</p>
                                  <p className="text-muted text-[10px]">Invoice created for {CRYPTO_META[selectedCrypto]?.symbol}</p>
                                </div>
                              </div>

                              {/* Open invoice */}
                              <button
                                onClick={() => invoiceUrl && window.open(invoiceUrl, '_blank')}
                                disabled={!invoiceUrl}
                                className={cn(
                                  'w-full py-2.5 rounded-lg font-semibold text-xs transition-all',
                                  invoiceUrl
                                    ? 'bg-brand text-background-deep hover:brightness-110 shadow-glow-brand-sm'
                                    : 'bg-surface border border-border text-muted cursor-not-allowed'
                                )}
                              >
                                Open Payment Page
                              </button>

                              {/* Back button */}
                              <button
                                onClick={resetDepositState}
                                className="w-full py-2.5 rounded-lg border border-border text-muted text-xs font-medium hover:text-white hover:border-brand/30 transition-all"
                              >
                                ← New Deposit
                              </button>

                              {/* Info */}
                              <div className="bg-background/50 rounded-lg p-2.5 text-[10px] text-muted space-y-1">
                                <div className="flex justify-between">
                                  <span>Network</span>
                                  <span className="text-white font-semibold">{CRYPTO_META[selectedCrypto]?.network}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Status</span>
                                  <span className="text-amber-400 font-semibold">Waiting for payment</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Auto-credit</span>
                                  <span className="text-brand font-semibold">After confirmation</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 space-y-3">
                          {/* Selected crypto */}
                          <div>
                            <label className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1.5 block">Currency</label>
                            <div className="grid grid-cols-3 gap-1.5">
                              {CRYPTO_META.map((c, i) => (
                                <button
                                  key={c.symbol}
                                  onClick={() => { setSelectedCrypto(i) }}
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

                          {/* Amount */}
                          <div>
                            <label className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1.5 block">Amount</label>
                            <input
                              type="number"
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                              placeholder="0.00"
                              min="0"
                              step="any"
                              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-white text-sm font-mono placeholder:text-muted/30 focus:outline-none focus:border-brand/50 transition-all"
                            />
                          </div>

                          {/* Address */}
                          <div>
                            <label className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1.5 block">Wallet Address</label>
                            <input
                              type="text"
                              value={withdrawAddress}
                              onChange={(e) => setWithdrawAddress(e.target.value)}
                              placeholder={`Your ${CRYPTO_META[selectedCrypto]?.symbol} address`}
                              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-white text-sm font-mono placeholder:text-muted/30 focus:outline-none focus:border-brand/50 transition-all"
                            />
                          </div>

                          {/* Network fee info */}
                          <div className="bg-background/50 rounded-lg p-2.5 text-[10px] text-muted space-y-1">
                            <div className="flex justify-between">
                              <span>Network</span>
                              <span className="text-white font-semibold">{CRYPTO_META[selectedCrypto]?.network}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Fee</span>
                              <span className="text-white font-semibold">
                                {CRYPTO_META[selectedCrypto]?.symbol === 'BTC' ? '0.0001 BTC' :
                                 CRYPTO_META[selectedCrypto]?.symbol === 'ETH' ? '0.005 ETH' :
                                 CRYPTO_META[selectedCrypto]?.symbol === 'SOL' ? '0.01 SOL' :
                                 CRYPTO_META[selectedCrypto]?.symbol === 'LTC' ? '0.001 LTC' :
                                 '1 ' + CRYPTO_META[selectedCrypto]?.symbol}
                              </span>
                            </div>
                          </div>

                          {/* Withdraw button */}
                          <button
                            onClick={handleWithdraw}
                            disabled={!withdrawAmount || !withdrawAddress || withdrawLoading}
                            className={cn(
                              'w-full py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2',
                              withdrawAmount && withdrawAddress && !withdrawLoading
                                ? 'bg-accent-red text-white hover:brightness-110'
                                : 'bg-surface border border-border text-muted cursor-not-allowed'
                            )}
                          >
                            {withdrawLoading ? (
                              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Processing...</>
                            ) : (
                              <><ArrowUp size={14} /> Withdraw {CRYPTO_META[selectedCrypto]?.symbol}</>
                            )}
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </>
                  )}
                </AnimatePresence>
              </div>

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 rounded-lg text-muted hover:text-white hover:bg-white/[0.04] transition-colors">
                    <Bell className="w-4 h-4" />
                    {notifUnread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-accent-red text-[9px] font-bold text-white">
                        {notifUnread > 9 ? '9+' : notifUnread}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-semibold text-white tracking-wide uppercase">Notifications</span>
                    {notifUnread > 0 && (
                      <button
                        onClick={() => markAllAsRead()}
                        className="text-[10px] text-brand hover:text-brand-dark transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <div className="max-h-80 overflow-y-auto scrollbar-thin">
                    {notifications.length === 0 ? (
                      <div className="px-3 py-6 text-center">
                        <Bell className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                        <p className="text-[11px] text-muted">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.slice(0, 15).map((n) => {
                        const style = NOTIF_STYLES[n.type] || NOTIF_STYLES.system
                        return (
                          <div
                            key={n.id}
                            onClick={() => markAsRead(n.id)}
                            className={cn(
                              'px-3 py-2 flex items-start gap-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors border-l-2',
                              n.read ? 'border-transparent opacity-60' : 'border-brand'
                            )}
                          >
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', style.bg)}>
                              <span className="text-sm">{style.emoji}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-white font-medium truncate">{n.title}</p>
                              <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-[9px] text-muted/50 mt-1">{timeAgo(n.timestamp)}</p>
                            </div>
                            {!n.read && <span className="w-2 h-2 bg-brand rounded-full shrink-0 mt-2" />}
                          </div>
                        )
                      })
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <button
                        onClick={() => clearAll()}
                        className="w-full px-3 py-2 text-[10px] text-muted hover:text-accent-red text-center transition-colors"
                      >
                        Clear all notifications
                      </button>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

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
                <Button variant="ghost" size="sm" className="text-[12px] sm:text-[13px] px-2 sm:px-3">
                  Log In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="text-[12px] sm:text-[13px] font-semibold shadow-glow-brand-sm px-2 sm:px-3">
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
