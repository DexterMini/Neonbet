'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDown, ArrowUp, Copy, Check,
  QrCode, Clock, AlertCircle, ChevronDown,
  X, Wallet,
} from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Sidebar } from '@/components/Sidebar'
import { Button, Badge } from '@/components/ui'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'

interface CryptoBalance {
  id: string
  name: string
  symbol: string
  icon: string
  balance: number
  locked: number
}

interface Transaction {
  type: 'deposit' | 'withdraw' | 'bet' | 'win'
  amount: string
  currency: string
  status: string
  time: string
}

const CRYPTO_META: Record<string, { name: string; icon: string }> = {
  BTC: { name: 'Bitcoin', icon: '₿' },
  ETH: { name: 'Ethereum', icon: 'Ξ' },
  LTC: { name: 'Litecoin', icon: 'Ł' },
  USDT: { name: 'Tether', icon: '₮' },
  USDC: { name: 'USD Coin', icon: '$' },
  SOL: { name: 'Solana', icon: '◎' },
}

const PRICES: Record<string, number> = {
  BTC: 46800, ETH: 3200, LTC: 70, USDT: 1, USDC: 1, SOL: 150,
}

export default function WalletPage() {
  const { token, user, isAuthenticated, isHydrated } = useAuthStore()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [copied, setCopied] = useState(false)
  const [showCryptoSelect, setShowCryptoSelect] = useState(false)
  const [nonadaOpen, setNonadaOpen] = useState(false)

  // Live data
  const [cryptos, setCryptos] = useState<CryptoBalance[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [depositAddress, setDepositAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedSymbol, setSelectedSymbol] = useState('BTC')

  const selectedCrypto = cryptos.find(c => c.symbol === selectedSymbol) || cryptos[0]
  const totalBalance = cryptos.reduce((s, c) => s + c.balance * (PRICES[c.symbol] || 0), 0)

  const authHeaders = useCallback(
    (): Record<string, string> =>
      token ? { Authorization: `Bearer ${token}` } : {},
    [token],
  )

  // ---- Fetch balances ----
  const fetchBalances = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/v1/wallet/balances', { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      const list: CryptoBalance[] = (data.balances ?? []).map((b: any) => {
        const sym = (b.currency || '').toUpperCase()
        const meta = CRYPTO_META[sym] || { name: sym, icon: '?' }
        return {
          id: sym.toLowerCase(),
          name: meta.name,
          symbol: sym,
          icon: meta.icon,
          balance: parseFloat(b.available || '0'),
          locked: parseFloat(b.locked || '0'),
        }
      })
      setCryptos(list.length ? list : defaultCryptos())
    } catch {
      setCryptos(defaultCryptos())
    }
  }, [token, authHeaders])

  // ---- Fetch transactions ----
  const fetchTransactions = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/v1/wallet/transactions?limit=10', {
        headers: authHeaders(),
      })
      if (!res.ok) return
      const data = await res.json()
      setTransactions(
        (data.transactions ?? []).map((t: any) => ({
          type: (t.event_type || '').includes('deposit')
            ? 'deposit'
            : (t.event_type || '').includes('withdrawal')
              ? 'withdraw'
              : (t.event_type || '').includes('win')
                ? 'win'
                : 'bet',
          amount: `${parseFloat(t.amount) >= 0 ? '+' : ''}${t.amount} ${(t.currency || '').toUpperCase()}`,
          currency: (t.currency || '').toUpperCase(),
          status: 'completed',
          time: t.created_at ? timeAgo(t.created_at) : '',
        })),
      )
    } catch {
      /* ignore */
    }
  }, [token, authHeaders])

  // ---- Fetch deposit address ----
  const fetchDepositAddress = useCallback(async (sym: string) => {
    if (!token) { setDepositAddress(''); return }
    try {
      const res = await fetch(`/api/v1/wallet/deposit/address/${sym.toLowerCase()}`, {
        headers: authHeaders(),
      })
      if (!res.ok) { setDepositAddress(''); return }
      const data = await res.json()
      setDepositAddress(data.address || '')
    } catch {
      setDepositAddress('')
    }
  }, [token, authHeaders])

  // ---- Init ----
  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      setCryptos(defaultCryptos())
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([fetchBalances(), fetchTransactions()]).finally(() => setLoading(false))
  }, [isHydrated, isAuthenticated, fetchBalances, fetchTransactions])

  useEffect(() => {
    fetchDepositAddress(selectedSymbol)
  }, [selectedSymbol, fetchDepositAddress])

  // NoNada postMessage listener
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'NONADA_DEPOSIT_SUCCESS') {
        toast.success(`Deposit received: ${e.data.amount} SOL`)
        setNonadaOpen(false)
        fetchBalances()
        fetchTransactions()
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [fetchBalances, fetchTransactions])

  const copyAddress = () => {
    if (!depositAddress) return
    navigator.clipboard.writeText(depositAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-h2 text-text-primary">Wallet</h1>
              <p className="text-small text-text-muted mt-1">Manage your crypto deposits and withdrawals</p>
            </div>

            {/* Total Balance Card */}
            <div className="relative bg-surface border border-border rounded-2xl p-6 sm:p-8 mb-8 overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand/[0.04] rounded-full blur-[100px] pointer-events-none" />
              <div className="relative">
                <p className="text-small text-text-muted mb-1">Total Balance</p>
                <p className="text-4xl sm:text-5xl font-bold text-text-primary mb-6 tracking-tight">
                  {loading ? '...' : formatCurrency(totalBalance)}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant={activeTab === 'deposit' ? 'primary' : 'secondary'} onClick={() => setActiveTab('deposit')}>
                    <ArrowDown className="w-4 h-4 mr-2" /> Deposit
                  </Button>
                  <Button variant="secondary" disabled className="opacity-50 cursor-not-allowed">
                    <ArrowUp className="w-4 h-4 mr-2" /> Withdraw
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-accent-amber">Soon</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr,380px] gap-6">
              {/* Left Side */}
              <div className="space-y-6">
                {/* Crypto Balances */}
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="p-5 border-b border-border">
                    <h2 className="text-base font-semibold text-text-primary">Your Assets</h2>
                  </div>
                  <div className="divide-y divide-border">
                    {(loading ? defaultCryptos() : cryptos).map((c) => {
                      const usdValue = c.balance * (PRICES[c.symbol] || 0)
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedSymbol(c.symbol)}
                          className={cn(
                            'w-full flex items-center justify-between p-4 transition-colors',
                            'hover:bg-surface-light',
                            selectedSymbol === c.symbol && 'bg-surface-light',
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-brand/[0.08] flex items-center justify-center text-xl font-bold text-brand">
                              {c.icon}
                            </div>
                            <div className="text-left">
                              <p className="text-text-primary font-medium text-sm">{c.name}</p>
                              <p className="text-text-muted text-xs">{c.symbol}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-text-primary font-semibold text-sm">
                              {c.balance} {c.symbol}
                            </p>
                            <p className="text-text-muted text-xs">{formatCurrency(usdValue)}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Transaction History */}
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="p-5 border-b border-border">
                    <h2 className="text-base font-semibold text-text-primary">Transaction History</h2>
                  </div>
                  <div className="divide-y divide-border">
                    {transactions.length === 0 && (
                      <div className="p-8 text-center text-text-muted text-sm">No transactions yet</div>
                    )}
                    {transactions.map((tx, i) => (
                      <div key={i} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center',
                            tx.type === 'deposit' || tx.type === 'win'
                              ? 'bg-accent-green/10 text-accent-green'
                              : 'bg-accent-red/10 text-accent-red',
                          )}>
                            {tx.type === 'deposit' || tx.type === 'win'
                              ? <ArrowDown className="w-5 h-5" />
                              : <ArrowUp className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-text-primary font-medium text-sm capitalize">{tx.type}</p>
                            <p className="text-text-muted text-xs flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {tx.time}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            'font-semibold text-sm',
                            tx.type === 'deposit' || tx.type === 'win' ? 'text-accent-green' : 'text-accent-red',
                          )}>
                            {tx.amount}
                          </p>
                          <Badge variant={tx.status === 'completed' ? 'success' : 'warning'} size="sm" dot>
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Side — Deposit / Withdraw Panel */}
              <div className="bg-surface border border-border rounded-xl p-5 h-fit sticky top-4">
                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-background rounded-lg mb-6">
                  <button
                    onClick={() => setActiveTab('deposit')}
                    className={cn(
                      'flex-1 py-2.5 rounded-md text-sm font-semibold transition-colors',
                      activeTab === 'deposit' ? 'bg-brand text-background' : 'text-text-muted hover:text-text-primary',
                    )}
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() => setActiveTab('withdraw')}
                    className={cn(
                      'flex-1 py-2.5 rounded-md text-sm font-semibold transition-colors relative',
                      'text-text-muted/50 cursor-not-allowed',
                    )}
                    disabled
                  >
                    Withdraw
                    <span className="ml-1 text-[9px] text-accent-amber font-bold uppercase">Soon</span>
                  </button>
                </div>

                {/* Crypto Selector */}
                <div className="mb-6">
                  <label className="block text-text-muted text-xs font-medium mb-2">Select Currency</label>
                  <div className="relative">
                    <button
                      onClick={() => setShowCryptoSelect(!showCryptoSelect)}
                      className="w-full flex items-center justify-between p-3.5 bg-background border border-border rounded-lg hover:border-brand/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand/[0.08] flex items-center justify-center text-lg font-bold text-brand">
                          {selectedCrypto?.icon || '?'}
                        </div>
                        <span className="text-text-primary font-medium text-sm">{selectedCrypto?.name || selectedSymbol}</span>
                      </div>
                      <ChevronDown className={cn('w-4 h-4 text-text-muted transition-transform', showCryptoSelect && 'rotate-180')} />
                    </button>

                    <AnimatePresence>
                      {showCryptoSelect && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full left-0 right-0 mt-2 bg-surface-light border border-border rounded-lg overflow-hidden z-50 shadow-soft-lg"
                        >
                          {cryptos.map(c => (
                            <button
                              key={c.id}
                              onClick={() => { setSelectedSymbol(c.symbol); setShowCryptoSelect(false) }}
                              className="w-full flex items-center gap-3 p-3.5 hover:bg-surface-lighter transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-brand/[0.08] flex items-center justify-center text-lg font-bold text-brand">
                                {c.icon}
                              </div>
                              <span className="text-text-primary text-sm">{c.name}</span>
                              <span className="text-text-muted text-xs ml-auto">{c.symbol}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {activeTab === 'deposit' ? (
                  <>
                    {/* NoNada / Nwallet Quick Deposit */}
                    <div className="mb-6">
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => setNonadaOpen(true)}
                        disabled={!isAuthenticated}
                      >
                        <Wallet className="w-4 h-4 mr-2" /> Deposit with Nwallet
                      </Button>
                    </div>

                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-text-muted text-xs">or send directly</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Deposit Address */}
                    <div className="mb-6">
                      <label className="block text-text-muted text-xs font-medium mb-2">Deposit Address</label>
                      <div className="p-3.5 bg-background rounded-lg border border-border">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-text-primary text-xs truncate flex-1 font-mono">
                            {depositAddress || 'Sign in to get your deposit address'}
                          </code>
                          {depositAddress && (
                            <button onClick={copyAddress} className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
                              {copied ? <Check className="w-4 h-4 text-accent-green" /> : <Copy className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="mb-6 flex justify-center">
                      <div className="p-3 bg-white rounded-xl">
                        <div className="w-36 h-36 bg-background rounded-lg flex items-center justify-center">
                          <QrCode className="w-20 h-20 text-text-muted" />
                        </div>
                      </div>
                    </div>

                    {/* Warning */}
                    <div className="p-3.5 bg-accent-amber/[0.06] border border-accent-amber/20 rounded-lg flex gap-3">
                      <AlertCircle className="w-4 h-4 text-accent-amber flex-shrink-0 mt-0.5" />
                      <p className="text-text-secondary text-xs leading-relaxed">
                        Only send <strong className="text-text-primary">{selectedSymbol}</strong> to this address. Sending other assets may result in permanent loss.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-accent-amber/10 flex items-center justify-center mb-4">
                      <ArrowUp className="w-8 h-8 text-accent-amber" />
                    </div>
                    <h3 className="text-text-primary font-semibold text-lg mb-2">Withdrawals Coming Soon</h3>
                    <p className="text-text-muted text-sm max-w-[260px]">
                      We&apos;re working on enabling withdrawals. This feature will be available shortly.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* NoNada / Nwallet Deposit Modal */}
      <AnimatePresence>
        {nonadaOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setNonadaOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-[420px] h-[600px] rounded-2xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <iframe
                src={`https://nonadawallet.com/embed/deposit?partnerId=demo&userId=${user?.id || 'guest'}&theme=dark`}
                className="w-full h-full border-none"
                allow="payment"
              />
              <button
                onClick={() => setNonadaOpen(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Helpers ----

function defaultCryptos(): CryptoBalance[] {
  return Object.entries(CRYPTO_META).map(([sym, meta]) => ({
    id: sym.toLowerCase(),
    name: meta.name,
    symbol: sym,
    icon: meta.icon,
    balance: 0,
    locked: 0,
  }))
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
