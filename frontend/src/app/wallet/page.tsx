'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDown, ArrowUp, Clock, ChevronDown,
  X, Wallet,
} from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Sidebar } from '@/components/Sidebar'
import { Button, Badge } from '@/components/ui'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { MobileNav } from '@/components/MobileNav'
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

const WITHDRAWAL_FEES: Record<string, number> = {
  BTC: 0.0001,
  ETH: 0.005,
  USDT: 1,
  USDC: 1,
  SOL: 0.01,
  LTC: 0.001,
}

const PRICES: Record<string, number> = {
  BTC: 46800, ETH: 3200, LTC: 70, USDT: 1, USDC: 1, SOL: 150,
}

export default function WalletPage() {
  const { token, user, isAuthenticated, isHydrated } = useAuthStore()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositStatus, setDepositStatus] = useState<'idle' | 'waiting'>('idle')
  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [showCryptoSelect, setShowCryptoSelect] = useState(false)
  const [nonadaOpen, setNonadaOpen] = useState(false)

  // Live data
  const [cryptos, setCryptos] = useState<CryptoBalance[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
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
    setDepositAmount('')
    setInvoiceUrl('')
    setDepositStatus('idle')
  }, [selectedSymbol])

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

  const createDepositInvoice = async () => {
    if (!token) {
      toast.error('Sign in to create a deposit')
      return
    }
    const amount = parseFloat(depositAmount)
    if (!amount || amount < 1) {
      toast.error('Minimum deposit is $1')
      return
    }

    setDepositLoading(true)
    try {
      const res = await fetch('/api/v1/payments/deposit/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          amount_usd: amount,
          currency: selectedSymbol,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || 'Failed to create deposit invoice')
      }
      const data = await res.json()
      if (!data.invoice_url) {
        throw new Error('Payment provider did not return an invoice URL')
      }
      setInvoiceUrl(data.invoice_url)
      setDepositStatus('waiting')
      window.open(data.invoice_url, '_blank')
      toast.success('Payment page opened in a new tab')
    } catch (err: any) {
      toast.error(err?.message || 'Deposit failed')
    } finally {
      setDepositLoading(false)
    }
  }

  const resetDeposit = () => {
    setDepositAmount('')
    setInvoiceUrl('')
    setDepositStatus('idle')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-mobile-nav">
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
                  <Button variant={activeTab === 'withdraw' ? 'primary' : 'secondary'} onClick={() => setActiveTab('withdraw')}>
                    <ArrowUp className="w-4 h-4 mr-2" /> Withdraw
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
                      'flex-1 py-2.5 rounded-md text-sm font-semibold transition-colors',
                      activeTab === 'withdraw' ? 'bg-brand text-background' : 'text-text-muted hover:text-text-primary',
                    )}
                  >
                    Withdraw
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
                      <span className="text-text-muted text-xs">or pay via invoice</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {depositStatus === 'idle' ? (
                      <>
                        {/* Deposit amount */}
                        <div className="mb-4">
                          <label className="block text-text-muted text-xs font-medium mb-2">Deposit Amount (USD)</label>
                          <input
                            type="number"
                            value={depositAmount}
                            onChange={e => setDepositAmount(e.target.value)}
                            placeholder="0.00"
                            min="1"
                            className="w-full p-3.5 bg-background border border-border rounded-lg text-text-primary text-lg font-bold placeholder:text-text-muted/40 focus:outline-none transition-colors"
                          />
                          <div className="grid grid-cols-4 gap-2 mt-2">
                            {['10', '25', '50', '100'].map((v) => (
                              <button
                                key={v}
                                onClick={() => setDepositAmount(v)}
                                className={cn(
                                  'py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                  depositAmount === v
                                    ? 'bg-brand/15 border-brand/40 text-brand'
                                    : 'bg-background border-border text-muted hover:text-text-primary hover:border-brand/30'
                                )}
                              >
                                ${v}
                              </button>
                            ))}
                          </div>
                        </div>

                        <Button
                          className="w-full"
                          size="lg"
                          onClick={createDepositInvoice}
                          disabled={!depositAmount || depositLoading}
                        >
                          {depositLoading ? 'Creating invoice...' : `Pay ${selectedSymbol} via Invoice`}
                        </Button>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3.5 bg-background rounded-lg border border-border text-xs text-text-muted">
                          Invoice created. Complete payment in the new tab. Funds will credit after confirmation.
                        </div>
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={() => invoiceUrl && window.open(invoiceUrl, '_blank')}
                          disabled={!invoiceUrl}
                        >
                          Open Payment Page
                        </Button>
                        <Button
                          className="w-full"
                          variant="secondary"
                          size="lg"
                          onClick={resetDeposit}
                        >
                          New Deposit
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="relative">
                    {/* Withdraw form */}
                    <div>
                      {/* Withdraw Amount */}
                      <div className="mb-4">
                        <label className="block text-text-muted text-xs font-medium mb-2">Amount</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={withdrawAmount}
                            onChange={e => setWithdrawAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full p-3.5 bg-background border border-border rounded-lg text-text-primary text-lg font-bold placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/30 transition-colors"
                          />
                          <button
                              className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-brand/10 text-brand text-xs font-semibold rounded-md hover:bg-brand/20 transition-colors"
                          >
                            MAX
                          </button>
                        </div>
                        <p className="text-text-muted text-xs mt-2">
                          Available: {selectedCrypto?.balance || 0} {selectedSymbol}
                        </p>
                      </div>

                      {/* Withdraw Address */}
                      <div className="mb-6">
                        <label className="block text-text-muted text-xs font-medium mb-2">Withdrawal Address</label>
                        <input
                          type="text"
                          value={withdrawAddress}
                          onChange={e => setWithdrawAddress(e.target.value)}
                          placeholder={`Enter ${selectedSymbol} address`}
                          className="w-full p-3.5 bg-background border border-border rounded-lg text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/30 transition-colors"
                        />
                      </div>

                      {/* Fees */}
                      <div className="p-3.5 bg-background rounded-lg mb-6 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-muted">Network Fee</span>
                          <span className="text-text-primary">{WITHDRAWAL_FEES[selectedSymbol] ?? '0.0005'} {selectedSymbol}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-text-muted">You&apos;ll receive</span>
                          <span className="text-text-primary font-semibold">0.00 {selectedSymbol}</span>
                        </div>
                      </div>

                      {/* Withdraw Button */}
                      <Button
                        className="w-full"
                        size="lg"
                        disabled={!withdrawAmount || !withdrawAddress}
                      >
                        Withdraw {selectedSymbol}
                      </Button>
                    </div>
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
                src={`https://nonadawallet.com/embed/deposit?partnerId=${process.env.NEXT_PUBLIC_NONADA_PARTNER_ID || ''}&userId=${user?.id || 'guest'}&theme=dark`}
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

      <MobileNav />
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
