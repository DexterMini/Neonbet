'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Users, Search, DollarSign, ArrowUpCircle, ArrowDownCircle,
  AlertTriangle, TrendingUp, Activity, Eye, Ban, Snowflake,
  RefreshCw, Gift, ChevronDown, X, Clock, CheckCircle,
  BarChart3, Wallet, Zap, UserCheck, Lock, Unlock,
  Settings, Percent, CreditCard, Star, ToggleLeft, ToggleRight,
  Trash2, Save, PieChart,
} from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Sidebar } from '@/components/Sidebar'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useAutomationStore, type CashbackConfig } from '@/stores/automationStore'
import { toast } from 'sonner'

/* ── Types ──────────────────────────────────────────── */
interface AdminUser {
  user_id: string
  username: string
  email: string
  status: string
  vip_level: number
  risk_score: number
  created_at: string
  balances?: Record<string, string>
  stats?: { total_bets: number }
}

interface SystemStats {
  active_users_24h: number
  total_bets_24h: number
  total_wagered_24h: string
  gross_gaming_revenue_24h: string
  deposits_24h: string
  withdrawals_24h: string
  pending_withdrawals: number
  unresolved_alerts: number
}

type AdminTab = 'overview' | 'users' | 'adjustments' | 'automation' | 'audit'

/* ── Admin Password Gate ───────────────────────────── */
const ADMIN_PIN = '1337A6B'

/* ── Toggle helper ─────────────────────────────────── */
function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label?: string }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2" type="button">
      {on ? (
        <ToggleRight className="w-7 h-7 text-accent-green" />
      ) : (
        <ToggleLeft className="w-7 h-7 text-text-muted" />
      )}
      {label && <span className="text-sm text-text-primary">{label}</span>}
    </button>
  )
}

/* ── Component ─────────────────────────────────────── */
export default function AdminDashboard() {
  const { token } = useAuthStore()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)

  const [tab, setTab] = useState<AdminTab>('overview')
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(false)

  // Adjustment form
  const [adjUserId, setAdjUserId] = useState('')
  const [adjType, setAdjType] = useState<'credit' | 'debit'>('credit')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjCurrency, setAdjCurrency] = useState('USD')
  const [adjReason, setAdjReason] = useState('')
  const [adjSubmitting, setAdjSubmitting] = useState(false)

  // Audit log
  const [auditLog, setAuditLog] = useState<any[]>([])

  // Automation store
  const automation = useAutomationStore()

  const headers = useCallback(
    (): Record<string, string> =>
      token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    [token],
  )

  const apiBase = process.env.NEXT_PUBLIC_API_URL || ''

  /* ── Auth gate ─────────────────────────────────── */
  const handlePinSubmit = () => {
    if (pinInput === ADMIN_PIN) {
      setAuthenticated(true)
      setPinError(false)
    } else {
      setPinError(true)
      setTimeout(() => setPinError(false), 2000)
    }
  }

  /* ── Fetch stats ───────────────────────────────── */
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/stats/overview`, { headers: headers() })
      if (res.ok) setStats(await res.json())
    } catch { /* ignore */ }
  }, [apiBase, headers])

  /* ── Fetch users ───────────────────────────────── */
  const fetchUsers = useCallback(async (query?: string) => {
    setLoading(true)
    try {
      const url = query
        ? `${apiBase}/api/v1/admin/users/search?query=${encodeURIComponent(query)}`
        : `${apiBase}/api/v1/admin/users/search?limit=50`
      const res = await fetch(url, { headers: headers() })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [apiBase, headers])

  /* ── Fetch user details ────────────────────────── */
  const fetchUserDetails = async (userId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/users/${userId}`, { headers: headers() })
      if (res.ok) setSelectedUser(await res.json())
    } catch { /* ignore */ }
  }

  /* ── User action ───────────────────────────────── */
  const handleUserAction = async (userId: string, action: string, reason: string) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/users/action`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ user_id: userId, action, reason }),
      })
      if (res.ok) {
        toast.success(`Action "${action}" applied successfully`)
        fetchUsers(searchQuery)
        if (selectedUser?.user_id === userId) fetchUserDetails(userId)
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.detail || 'Action failed')
      }
    } catch { toast.error('Network error') }
  }

  /* ── Adjust balance ────────────────────────────── */
  const handleAdjustBalance = async () => {
    if (!adjUserId || !adjAmount || !adjReason) {
      toast.error('Fill in all fields')
      return
    }
    setAdjSubmitting(true)
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/users/adjust-balance`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          user_id: adjUserId,
          currency: adjCurrency.toLowerCase(),
          amount: parseFloat(adjAmount),
          type: adjType,
          reason: adjReason,
        }),
      })
      if (res.ok) {
        toast.success(`${adjType === 'credit' ? 'Credited' : 'Debited'} ${adjAmount} ${adjCurrency} successfully`)
        setAdjAmount('')
        setAdjReason('')
        fetchAuditLog()
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.detail || 'Adjustment failed')
      }
    } catch { toast.error('Network error') }
    setAdjSubmitting(false)
  }

  /* ── Fetch audit log ───────────────────────────── */
  const fetchAuditLog = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/audit-log?limit=50`, { headers: headers() })
      if (res.ok) {
        const data = await res.json()
        setAuditLog(data.actions || [])
      }
    } catch { /* ignore */ }
  }, [apiBase, headers])

  /* ── Init ──────────────────────────────────────── */
  useEffect(() => {
    if (!authenticated) return
    fetchStats()
    fetchUsers()
    fetchAuditLog()
  }, [authenticated, fetchStats, fetchUsers, fetchAuditLog])

  /* ── PIN Screen ────────────────────────────────── */
  if (!authenticated) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm">
              <div className="bg-surface border border-border rounded-2xl p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-8 h-8 text-brand" />
                </div>
                <h1 className="text-xl font-bold text-text-primary mb-2">Admin Access</h1>
                <p className="text-text-muted text-sm mb-6">Enter admin PIN to continue</p>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                  placeholder="Enter PIN"
                  className={cn(
                    'w-full p-3.5 bg-background border rounded-xl text-text-primary text-center text-lg font-mono tracking-[0.3em] placeholder:tracking-normal placeholder:text-text-muted/40 focus:outline-none transition-colors mb-4',
                    pinError ? 'border-accent-red focus:border-accent-red' : 'border-border focus:border-brand/50',
                  )}
                />
                {pinError && <p className="text-accent-red text-xs mb-4">Invalid PIN</p>}
                <button
                  onClick={handlePinSubmit}
                  className="w-full py-3 rounded-xl bg-brand text-background font-semibold text-sm hover:brightness-110 transition-all"
                >
                  Unlock Dashboard
                </button>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    )
  }

  /* ── Dashboard ─────────────────────────────────── */
  const tabs: { key: AdminTab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'adjustments', label: 'Reload / Cashback', icon: Gift },
    { key: 'automation', label: 'Automation', icon: Settings },
    { key: 'audit', label: 'Audit Log', icon: Clock },
  ]

  const statCards = stats ? [
    { label: 'Active Users (24h)', value: stats.active_users_24h, icon: Users, color: 'text-brand' },
    { label: 'Total Bets (24h)', value: stats.total_bets_24h, icon: Activity, color: 'text-accent-cyan' },
    { label: 'Total Wagered (24h)', value: formatCurrency(parseFloat(stats.total_wagered_24h)), icon: DollarSign, color: 'text-accent-amber' },
    { label: 'GGR (24h)', value: formatCurrency(parseFloat(stats.gross_gaming_revenue_24h)), icon: TrendingUp, color: 'text-accent-green' },
    { label: 'Pending Withdrawals', value: stats.pending_withdrawals, icon: Wallet, color: 'text-accent-purple' },
    { label: 'Unresolved Alerts', value: stats.unresolved_alerts, icon: AlertTriangle, color: 'text-accent-red' },
  ] : []

  const ps = automation.profitStats

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h1 className="text-h2 text-text-primary">Admin Dashboard</h1>
                  <p className="text-small text-text-muted">Manage users, balances, automation & platform</p>
                </div>
              </div>
              <button
                onClick={() => { fetchStats(); fetchUsers(searchQuery); fetchAuditLog() }}
                className="p-2.5 rounded-xl bg-surface border border-border text-text-muted hover:text-text-primary transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl mb-8 overflow-x-auto">
              {tabs.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                      tab === t.key
                        ? 'bg-brand text-background'
                        : 'text-text-muted hover:text-text-primary hover:bg-surface-light',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                )
              })}
            </div>

            {/* ══════════════ OVERVIEW ══════════════ */}
            {tab === 'overview' && (
              <div className="space-y-6">
                {statCards.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {statCards.map((s) => {
                      const Icon = s.icon
                      return (
                        <div key={s.label} className="bg-surface border border-border rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={cn('w-4 h-4', s.color)} />
                            <span className="text-text-muted text-[11px] font-medium uppercase tracking-wider">{s.label}</span>
                          </div>
                          <p className="text-text-primary text-xl font-bold">{s.value}</p>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Autonomous Profit Dashboard */}
                <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-brand" /> Autonomous Profit Dashboard
                    </h2>
                    <button
                      onClick={() => { if (confirm('Reset all profit stats?')) automation.resetProfitStats() }}
                      className="text-text-muted hover:text-accent-red text-xs flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Reset
                    </button>
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                      {[
                        { label: 'Total Bets', value: ps.totalBets.toLocaleString(), color: 'text-brand' },
                        { label: 'Total Wagered', value: formatCurrency(ps.totalWagered), color: 'text-accent-cyan' },
                        { label: 'Total Payouts', value: formatCurrency(ps.totalPayouts), color: 'text-accent-amber' },
                        { label: 'Gross Profit', value: formatCurrency(ps.grossProfit), color: ps.grossProfit >= 0 ? 'text-accent-green' : 'text-accent-red' },
                        { label: 'Cashback Paid', value: formatCurrency(ps.totalCashbackPaid), color: 'text-accent-purple' },
                        { label: 'Bonuses Paid', value: formatCurrency(ps.totalBonusesPaid), color: 'text-accent-amber' },
                        { label: 'Net Profit', value: formatCurrency(ps.netProfit), color: ps.netProfit >= 0 ? 'text-accent-green' : 'text-accent-red' },
                      ].map((s) => (
                        <div key={s.label} className="bg-background rounded-xl p-3">
                          <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">{s.label}</p>
                          <p className={cn('font-bold text-sm font-mono', s.color)}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {Object.keys(ps.perGame).length > 0 && (
                      <div>
                        <h3 className="text-text-muted text-xs font-medium uppercase tracking-wider mb-3">Per-Game Breakdown</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left p-2.5 text-text-muted text-xs uppercase">Game</th>
                                <th className="text-right p-2.5 text-text-muted text-xs uppercase">Bets</th>
                                <th className="text-right p-2.5 text-text-muted text-xs uppercase">Wagered</th>
                                <th className="text-right p-2.5 text-text-muted text-xs uppercase">Payouts</th>
                                <th className="text-right p-2.5 text-text-muted text-xs uppercase">Profit</th>
                                <th className="text-right p-2.5 text-text-muted text-xs uppercase">Eff. Edge</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(ps.perGame).map(([game, gs]) => (
                                <tr key={game} className="border-b border-border/30 hover:bg-surface-light transition-colors">
                                  <td className="p-2.5 text-text-primary font-medium capitalize">{game}</td>
                                  <td className="p-2.5 text-right text-text-muted font-mono">{gs.bets}</td>
                                  <td className="p-2.5 text-right text-text-muted font-mono">{formatCurrency(gs.wagered)}</td>
                                  <td className="p-2.5 text-right text-text-muted font-mono">{formatCurrency(gs.payouts)}</td>
                                  <td className={cn('p-2.5 text-right font-mono font-semibold', gs.profit >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                                    {formatCurrency(gs.profit)}
                                  </td>
                                  <td className={cn('p-2.5 text-right font-mono', gs.effectiveEdge >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                                    {gs.effectiveEdge.toFixed(2)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {ps.totalBets === 0 && (
                      <div className="text-center py-6">
                        <Activity className="w-8 h-8 text-text-muted mx-auto mb-2" />
                        <p className="text-text-muted text-sm">No bets tracked yet. Stats appear automatically as bets are placed.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ USERS ══════════════ */}
            {tab === 'users' && (
              <div className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchUsers(searchQuery)} placeholder="Search by username or email..." className="w-full pl-11 pr-4 py-3 bg-surface border border-border rounded-xl text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-brand/50 transition-colors" />
                </div>
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-4 text-text-muted font-medium text-xs uppercase tracking-wider">User</th>
                          <th className="text-left p-4 text-text-muted font-medium text-xs uppercase tracking-wider">Status</th>
                          <th className="text-left p-4 text-text-muted font-medium text-xs uppercase tracking-wider">VIP</th>
                          <th className="text-left p-4 text-text-muted font-medium text-xs uppercase tracking-wider">Risk</th>
                          <th className="text-right p-4 text-text-muted font-medium text-xs uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 ? (
                          <tr><td colSpan={5} className="p-8 text-center text-text-muted">{loading ? 'Loading...' : 'No users found.'}</td></tr>
                        ) : users.map((u) => (
                          <tr key={u.user_id} className="border-b border-border/50 hover:bg-surface-light transition-colors">
                            <td className="p-4">
                              <p className="text-text-primary font-medium">{u.username}</p>
                              <p className="text-text-muted text-xs">{u.email}</p>
                            </td>
                            <td className="p-4">
                              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', u.status === 'active' && 'bg-accent-green/10 text-accent-green', u.status === 'frozen' && 'bg-accent-blue/10 text-accent-blue', u.status === 'banned' && 'bg-accent-red/10 text-accent-red', !['active','frozen','banned'].includes(u.status) && 'bg-surface-light text-text-muted')}>{u.status}</span>
                            </td>
                            <td className="p-4"><span className="text-accent-amber font-semibold">Lv.{u.vip_level}</span></td>
                            <td className="p-4"><span className={cn('font-mono text-xs', u.risk_score < 30 && 'text-accent-green', u.risk_score >= 30 && u.risk_score < 60 && 'text-accent-amber', u.risk_score >= 60 && 'text-accent-red')}>{u.risk_score}</span></td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-1.5">
                                <button onClick={() => { fetchUserDetails(u.user_id); setAdjUserId(u.user_id) }} className="p-1.5 rounded-lg hover:bg-brand/10 text-text-muted hover:text-brand transition-colors" title="View details"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => { setAdjUserId(u.user_id); setTab('adjustments') }} className="p-1.5 rounded-lg hover:bg-accent-green/10 text-text-muted hover:text-accent-green transition-colors" title="Give reload"><Gift className="w-4 h-4" /></button>
                                {u.status === 'active' ? <button onClick={() => handleUserAction(u.user_id, 'freeze', 'Admin freeze')} className="p-1.5 rounded-lg hover:bg-accent-blue/10 text-text-muted hover:text-accent-blue transition-colors" title="Freeze"><Snowflake className="w-4 h-4" /></button> : u.status === 'frozen' ? <button onClick={() => handleUserAction(u.user_id, 'unfreeze', 'Admin unfreeze')} className="p-1.5 rounded-lg hover:bg-accent-green/10 text-text-muted hover:text-accent-green transition-colors" title="Unfreeze"><Unlock className="w-4 h-4" /></button> : null}
                                {u.status !== 'banned' ? <button onClick={() => handleUserAction(u.user_id, 'ban', 'Admin ban')} className="p-1.5 rounded-lg hover:bg-accent-red/10 text-text-muted hover:text-accent-red transition-colors" title="Ban"><Ban className="w-4 h-4" /></button> : <button onClick={() => handleUserAction(u.user_id, 'unban', 'Admin unban')} className="p-1.5 rounded-lg hover:bg-accent-green/10 text-text-muted hover:text-accent-green transition-colors" title="Unban"><UserCheck className="w-4 h-4" /></button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* User detail modal */}
                <AnimatePresence>
                  {selectedUser && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
                      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-border">
                          <div><h3 className="text-lg font-bold text-text-primary">{selectedUser.username}</h3><p className="text-xs text-text-muted">{selectedUser.email}</p></div>
                          <button onClick={() => setSelectedUser(null)} className="p-2 rounded-lg hover:bg-surface-light text-text-muted"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            {[
                              { label: 'Status', value: selectedUser.status, color: selectedUser.status === 'active' ? 'text-accent-green' : selectedUser.status === 'frozen' ? 'text-accent-blue' : 'text-accent-red' },
                              { label: 'VIP Level', value: String(selectedUser.vip_level), color: 'text-accent-amber' },
                              { label: 'Total Bets', value: String(selectedUser.stats?.total_bets || 0), color: 'text-text-primary' },
                            ].map(s => (
                              <div key={s.label} className="bg-background rounded-xl p-3 text-center">
                                <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">{s.label}</p>
                                <p className={cn('font-bold text-sm capitalize', s.color)}>{s.value}</p>
                              </div>
                            ))}
                          </div>
                          {selectedUser.balances && Object.keys(selectedUser.balances).length > 0 && (
                            <div>
                              <h4 className="text-text-muted text-xs font-medium uppercase tracking-wider mb-2">Balances</h4>
                              <div className="space-y-1.5">
                                {Object.entries(selectedUser.balances).map(([cur, amt]) => (
                                  <div key={cur} className="flex justify-between items-center p-2.5 bg-background rounded-lg">
                                    <span className="text-text-muted text-sm">{cur}</span>
                                    <span className="text-text-primary font-mono font-semibold text-sm">{amt}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <button onClick={() => { setAdjUserId(selectedUser.user_id); setSelectedUser(null); setTab('adjustments') }} className="w-full py-2.5 rounded-xl bg-brand text-background font-semibold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2">
                            <Gift className="w-4 h-4" /> Give Reload / Cashback
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ══════════════ ADJUSTMENTS ══════════════ */}
            {tab === 'adjustments' && (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-border">
                    <h2 className="text-base font-semibold text-text-primary flex items-center gap-2"><Gift className="w-5 h-5 text-brand" /> Give Reload / Cashback / Manual Adjustment</h2>
                    <p className="text-text-muted text-xs mt-1">Credit or debit a user&apos;s balance</p>
                  </div>
                  <div className="p-5 space-y-5">
                    <div>
                      <label className="block text-text-muted text-xs font-medium mb-2">User ID</label>
                      <input type="text" value={adjUserId} onChange={(e) => setAdjUserId(e.target.value)} placeholder="Paste user ID or select from Users tab" className="w-full p-3 bg-background border border-border rounded-xl text-text-primary text-sm placeholder:text-text-muted/40 focus:outline-none focus:border-brand/50 transition-colors font-mono" />
                    </div>
                    <div>
                      <label className="block text-text-muted text-xs font-medium mb-2">Type</label>
                      <div className="flex gap-2">
                        <button onClick={() => setAdjType('credit')} className={cn('flex-1 py-3 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2', adjType === 'credit' ? 'bg-accent-green/10 text-accent-green border-accent-green/30' : 'bg-background text-text-muted border-border hover:border-border-light')}><ArrowDownCircle className="w-4 h-4" /> Credit (Give)</button>
                        <button onClick={() => setAdjType('debit')} className={cn('flex-1 py-3 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2', adjType === 'debit' ? 'bg-accent-red/10 text-accent-red border-accent-red/30' : 'bg-background text-text-muted border-border hover:border-border-light')}><ArrowUpCircle className="w-4 h-4" /> Debit (Take)</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-text-muted text-xs font-medium mb-2">Amount</label>
                      <div className="flex gap-3">
                        <input type="number" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} placeholder="0.00" className="flex-1 p-3 bg-background border border-border rounded-xl text-text-primary text-lg font-bold font-mono placeholder:text-text-muted/40 focus:outline-none focus:border-brand/50 transition-colors" />
                        <select value={adjCurrency} onChange={(e) => setAdjCurrency(e.target.value)} className="px-4 py-3 bg-background border border-border rounded-xl text-text-primary text-sm font-semibold focus:outline-none">
                          {['USD','BTC','ETH','SOL','USDT','LTC'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {['5','10','25','50','100','500'].map(v => (
                          <button key={v} onClick={() => setAdjAmount(v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border', adjAmount === v ? 'bg-brand/10 text-brand border-brand/30' : 'bg-background text-text-muted border-border hover:border-border-light')}>${v}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-text-muted text-xs font-medium mb-2">Reason</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {['Reload Bonus','Cashback','VIP Reward','Compensation','Manual Correction','Promo Code'].map(r => (
                          <button key={r} onClick={() => setAdjReason(r)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all border', adjReason === r ? 'bg-brand/10 text-brand border-brand/30' : 'bg-background text-text-muted border-border hover:border-border-light')}>{r}</button>
                        ))}
                      </div>
                      <input type="text" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Or type a custom reason..." className="w-full p-3 bg-background border border-border rounded-xl text-text-primary text-sm placeholder:text-text-muted/40 focus:outline-none focus:border-brand/50 transition-colors" />
                    </div>
                    {adjUserId && adjAmount && adjReason && (
                      <div className={cn('p-4 rounded-xl border', adjType === 'credit' ? 'bg-accent-green/5 border-accent-green/20' : 'bg-accent-red/5 border-accent-red/20')}>
                        <p className="text-text-primary text-sm">{adjType === 'credit' ? '➕ Credit' : '➖ Debit'} <span className="font-bold font-mono">{adjAmount} {adjCurrency}</span> {adjType === 'credit' ? 'to' : 'from'} user <span className="font-mono text-xs text-text-muted">{adjUserId.slice(0, 12)}...</span></p>
                        <p className="text-text-muted text-xs mt-1">Reason: {adjReason}</p>
                      </div>
                    )}
                    <button onClick={handleAdjustBalance} disabled={!adjUserId || !adjAmount || !adjReason || adjSubmitting} className={cn('w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2', adjType === 'credit' ? 'bg-accent-green text-background hover:brightness-110' : 'bg-accent-red text-white hover:brightness-110', (!adjUserId || !adjAmount || !adjReason || adjSubmitting) && 'opacity-40 cursor-not-allowed')}>
                      {adjSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : adjType === 'credit' ? <><ArrowDownCircle className="w-4 h-4" /> Credit Balance</> : <><ArrowUpCircle className="w-4 h-4" /> Debit Balance</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════ */}
            {/* AUTOMATION TAB                            */}
            {/* ══════════════════════════════════════════ */}
            {tab === 'automation' && (
              <div className="space-y-6">

                {/* ─── Cashback Engine ─── */}
                <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                      <Percent className="w-5 h-5 text-accent-green" /> Automatic Cashback
                    </h2>
                    <Toggle on={automation.cashback.enabled} onToggle={() => automation.setCashbackConfig({ enabled: !automation.cashback.enabled })} />
                  </div>
                  {automation.cashback.enabled && (
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-text-muted text-xs font-medium mb-2">Cashback %</label>
                        <div className="relative">
                          <input type="number" value={automation.cashback.percentage} onChange={(e) => automation.setCashbackConfig({ percentage: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })} className="w-full p-3 bg-background border border-border rounded-xl text-text-primary text-sm font-mono focus:outline-none focus:border-brand/50" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
                        </div>
                        <p className="text-text-muted/60 text-[10px] mt-1">% of net losses returned</p>
                      </div>
                      <div>
                        <label className="block text-text-muted text-xs font-medium mb-2">Frequency</label>
                        <select value={automation.cashback.frequency} onChange={(e) => automation.setCashbackConfig({ frequency: e.target.value as CashbackConfig['frequency'] })} className="w-full p-3 bg-background border border-border rounded-xl text-text-primary text-sm focus:outline-none">
                          <option value="instant">Instant (per bet)</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-text-muted text-xs font-medium mb-2">Min Loss Threshold</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                          <input type="number" value={automation.cashback.minLossThreshold} onChange={(e) => automation.setCashbackConfig({ minLossThreshold: parseFloat(e.target.value) || 0 })} className="w-full p-3 pl-7 bg-background border border-border rounded-xl text-text-primary text-sm font-mono focus:outline-none focus:border-brand/50" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-text-muted text-xs font-medium mb-2">Max Cashback / Period</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                          <input type="number" value={automation.cashback.maxCashback} onChange={(e) => automation.setCashbackConfig({ maxCashback: parseFloat(e.target.value) || 0 })} className="w-full p-3 pl-7 bg-background border border-border rounded-xl text-text-primary text-sm font-mono focus:outline-none focus:border-brand/50" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── Deposit Bonus ─── */}
                <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-accent-cyan" /> Deposit Bonuses
                    </h2>
                    <Toggle on={automation.depositBonus.enabled} onToggle={() => automation.setDepositBonusConfig({ enabled: !automation.depositBonus.enabled })} />
                  </div>
                  {automation.depositBonus.enabled && (
                    <div className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-background rounded-xl p-4 border border-border">
                          <h3 className="text-text-primary text-sm font-semibold mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-accent-amber" /> First Deposit</h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-text-muted text-[10px] uppercase mb-1">Match %</label>
                              <div className="relative">
                                <input type="number" value={automation.depositBonus.firstDepositPercent} onChange={(e) => automation.setDepositBonusConfig({ firstDepositPercent: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 bg-surface border border-border rounded-lg text-text-primary text-sm font-mono focus:outline-none focus:border-brand/50" />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">%</span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-text-muted text-[10px] uppercase mb-1">Max Bonus</label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">$</span>
                                <input type="number" value={automation.depositBonus.firstDepositMax} onChange={(e) => automation.setDepositBonusConfig({ firstDepositMax: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 pl-6 bg-surface border border-border rounded-lg text-text-primary text-sm font-mono focus:outline-none focus:border-brand/50" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-background rounded-xl p-4 border border-border">
                          <h3 className="text-text-primary text-sm font-semibold mb-3 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-brand" /> Reload Deposits</h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-text-muted text-[10px] uppercase mb-1">Match %</label>
                              <div className="relative">
                                <input type="number" value={automation.depositBonus.reloadPercent} onChange={(e) => automation.setDepositBonusConfig({ reloadPercent: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 bg-surface border border-border rounded-lg text-text-primary text-sm font-mono focus:outline-none focus:border-brand/50" />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">%</span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-text-muted text-[10px] uppercase mb-1">Max Bonus</label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">$</span>
                                <input type="number" value={automation.depositBonus.reloadMax} onChange={(e) => automation.setDepositBonusConfig({ reloadMax: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 pl-6 bg-surface border border-border rounded-lg text-text-primary text-sm font-mono focus:outline-none focus:border-brand/50" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="max-w-xs">
                        <label className="block text-text-muted text-xs font-medium mb-2">Wagering Requirement</label>
                        <div className="relative">
                          <input type="number" value={automation.depositBonus.wageringReq} onChange={(e) => automation.setDepositBonusConfig({ wageringReq: parseFloat(e.target.value) || 1 })} className="w-full p-3 bg-background border border-border rounded-xl text-text-primary text-sm font-mono focus:outline-none focus:border-brand/50" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">x wagering</span>
                        </div>
                        <p className="text-text-muted/60 text-[10px] mt-1">Bonus must be wagered this many times before withdrawal</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── VIP Auto-Progression ─── */}
                <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                      <Star className="w-5 h-5 text-accent-amber" /> VIP Auto-Progression & Rewards
                    </h2>
                    <Toggle on={automation.vip.enabled} onToggle={() => automation.setVIPConfig({ enabled: !automation.vip.enabled })} />
                  </div>
                  {automation.vip.enabled && (
                    <div className="p-5">
                      <div className="flex gap-4 mb-5">
                        <Toggle on={automation.vip.autoProgression} onToggle={() => automation.setVIPConfig({ autoProgression: !automation.vip.autoProgression })} label="Auto Level-Up" />
                        <Toggle on={automation.vip.autoDistribute} onToggle={() => automation.setVIPConfig({ autoDistribute: !automation.vip.autoDistribute })} label="Auto-Distribute Bonuses" />
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left p-2.5 text-text-muted text-[10px] uppercase">Level</th>
                              <th className="text-right p-2.5 text-text-muted text-[10px] uppercase">Min Wagered</th>
                              <th className="text-right p-2.5 text-text-muted text-[10px] uppercase">Rakeback %</th>
                              <th className="text-right p-2.5 text-text-muted text-[10px] uppercase">Level-Up Bonus</th>
                              <th className="text-right p-2.5 text-text-muted text-[10px] uppercase">Weekly %</th>
                              <th className="text-right p-2.5 text-text-muted text-[10px] uppercase">Monthly %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {automation.vip.levels.map((lvl, i) => (
                              <tr key={lvl.level} className="border-b border-border/30 hover:bg-surface-light transition-colors">
                                <td className="p-2.5"><span className="text-accent-amber font-semibold">{lvl.name}</span></td>
                                <td className="p-2.5"><input type="number" value={lvl.minWagered} onChange={(e) => automation.updateVIPLevel(i, { minWagered: parseFloat(e.target.value) || 0 })} className="w-28 p-1.5 bg-background border border-border rounded-lg text-text-primary text-xs font-mono text-right focus:outline-none focus:border-brand/50" /></td>
                                <td className="p-2.5"><input type="number" value={lvl.rakebackPercent} onChange={(e) => automation.updateVIPLevel(i, { rakebackPercent: parseFloat(e.target.value) || 0 })} className="w-20 p-1.5 bg-background border border-border rounded-lg text-text-primary text-xs font-mono text-right focus:outline-none focus:border-brand/50" step="0.5" /></td>
                                <td className="p-2.5"><input type="number" value={lvl.levelUpBonus} onChange={(e) => automation.updateVIPLevel(i, { levelUpBonus: parseFloat(e.target.value) || 0 })} className="w-24 p-1.5 bg-background border border-border rounded-lg text-text-primary text-xs font-mono text-right focus:outline-none focus:border-brand/50" /></td>
                                <td className="p-2.5"><input type="number" value={lvl.weeklyBonusPercent} onChange={(e) => automation.updateVIPLevel(i, { weeklyBonusPercent: parseFloat(e.target.value) || 0 })} className="w-20 p-1.5 bg-background border border-border rounded-lg text-text-primary text-xs font-mono text-right focus:outline-none focus:border-brand/50" step="0.1" /></td>
                                <td className="p-2.5"><input type="number" value={lvl.monthlyBonusPercent} onChange={(e) => automation.updateVIPLevel(i, { monthlyBonusPercent: parseFloat(e.target.value) || 0 })} className="w-20 p-1.5 bg-background border border-border rounded-lg text-text-primary text-xs font-mono text-right focus:outline-none focus:border-brand/50" step="0.1" /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── House Edge per Game ─── */}
                <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-border">
                    <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-accent-red" /> House Edge & Game Limits
                    </h2>
                    <p className="text-text-muted text-xs mt-1">Configure house edge, bet limits, and max win per game</p>
                  </div>
                  <div className="p-5">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-2.5 text-text-muted text-[10px] uppercase">Game</th>
                            <th className="text-center p-2.5 text-text-muted text-[10px] uppercase">Enabled</th>
                            <th className="text-right p-2.5 text-text-muted text-[10px] uppercase">House Edge %</th>
                            <th className="text-right p-2.5 text-text-muted text-[10px] uppercase">Min Bet</th>
                            <th className="text-right p-2.5 text-text-muted text-[10px] uppercase">Max Bet</th>
                            <th className="text-right p-2.5 text-text-muted text-[10px] uppercase">Max Win</th>
                          </tr>
                        </thead>
                        <tbody>
                          {automation.gameEdges.map((g) => (
                            <tr key={g.game} className="border-b border-border/30 hover:bg-surface-light transition-colors">
                              <td className="p-2.5 text-text-primary font-medium">{g.label}</td>
                              <td className="p-2.5 text-center"><Toggle on={g.enabled} onToggle={() => automation.setGameEdge(g.game, { enabled: !g.enabled })} /></td>
                              <td className="p-2.5"><input type="number" value={(g.houseEdge * 100).toFixed(1)} onChange={(e) => automation.setGameEdge(g.game, { houseEdge: (parseFloat(e.target.value) || 0) / 100 })} className="w-20 p-1.5 bg-background border border-border rounded-lg text-text-primary text-xs font-mono text-right focus:outline-none focus:border-brand/50" step="0.1" /></td>
                              <td className="p-2.5"><input type="number" value={g.minBet} onChange={(e) => automation.setGameEdge(g.game, { minBet: parseFloat(e.target.value) || 0.10 })} className="w-24 p-1.5 bg-background border border-border rounded-lg text-text-primary text-xs font-mono text-right focus:outline-none focus:border-brand/50" step="0.10" /></td>
                              <td className="p-2.5"><input type="number" value={g.maxBet} onChange={(e) => automation.setGameEdge(g.game, { maxBet: parseFloat(e.target.value) || 100 })} className="w-28 p-1.5 bg-background border border-border rounded-lg text-text-primary text-xs font-mono text-right focus:outline-none focus:border-brand/50" /></td>
                              <td className="p-2.5"><input type="number" value={g.maxWin} onChange={(e) => automation.setGameEdge(g.game, { maxWin: parseFloat(e.target.value) || 1000 })} className="w-28 p-1.5 bg-background border border-border rounded-lg text-text-primary text-xs font-mono text-right focus:outline-none focus:border-brand/50" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-text-muted/60 text-[10px] mt-3 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> All settings auto-save to localStorage and persist across sessions
                    </p>
                  </div>
                </div>

                {/* ─── Status Summary ─── */}
                <div className="bg-surface border border-border rounded-2xl p-5">
                  <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-accent-amber" /> Active Automations
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Cashback', active: automation.cashback.enabled, value: `${automation.cashback.percentage}%`, sub: automation.cashback.frequency, color: 'green' as const },
                      { label: 'Deposit Bonus', active: automation.depositBonus.enabled, value: `${automation.depositBonus.firstDepositPercent}%`, sub: `1st / ${automation.depositBonus.reloadPercent}% reload`, color: 'cyan' as const },
                      { label: 'VIP System', active: automation.vip.enabled, value: `${automation.vip.levels.length} levels`, sub: `auto-${automation.vip.autoProgression ? 'on' : 'off'}`, color: 'amber' as const },
                      { label: 'Avg House Edge', active: true, value: `${(automation.gameEdges.filter(g => g.enabled).reduce((s, g) => s + g.houseEdge, 0) / Math.max(1, automation.gameEdges.filter(g => g.enabled).length) * 100).toFixed(2)}%`, sub: `${automation.gameEdges.filter(g => g.enabled).length} games`, color: 'brand' as const },
                    ].map(item => (
                      <div key={item.label} className={cn('rounded-xl p-4 border', item.active ? `bg-accent-${item.color}/5 border-accent-${item.color}/20` : 'bg-background border-border')}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-text-muted text-xs font-medium">{item.label}</span>
                          <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded', item.active ? `bg-accent-${item.color}/10 text-accent-${item.color}` : 'bg-surface-light text-text-muted')}>
                            {item.active ? 'ACTIVE' : 'OFF'}
                          </span>
                        </div>
                        {item.active && <p className="text-text-primary text-lg font-bold">{item.value} <span className="text-text-muted text-xs font-normal">{item.sub}</span></p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ AUDIT LOG ══════════════ */}
            {tab === 'audit' && (
              <div className="space-y-4">
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="text-base font-semibold text-text-primary">Admin Action Log</h2>
                    <button onClick={fetchAuditLog} className="text-text-muted hover:text-text-primary transition-colors"><RefreshCw className="w-4 h-4" /></button>
                  </div>
                  <div className="divide-y divide-border/50">
                    {auditLog.length === 0 ? (
                      <div className="p-8 text-center text-text-muted text-sm">No admin actions recorded yet</div>
                    ) : auditLog.map((a, i) => (
                      <div key={a.id || i} className="flex items-start gap-4 p-4 hover:bg-surface-light transition-colors">
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', a.action_type === 'adjust_balance' && 'bg-brand/10 text-brand', a.action_type === 'ban' && 'bg-accent-red/10 text-accent-red', a.action_type === 'freeze' && 'bg-accent-blue/10 text-accent-blue', (a.action_type === 'unban' || a.action_type === 'unfreeze') && 'bg-accent-green/10 text-accent-green', !['adjust_balance','ban','freeze','unban','unfreeze'].includes(a.action_type) && 'bg-surface-light text-text-muted')}>
                          {a.action_type === 'adjust_balance' ? <DollarSign className="w-4 h-4" /> : a.action_type === 'ban' ? <Ban className="w-4 h-4" /> : a.action_type === 'freeze' ? <Snowflake className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-text-primary font-medium text-sm capitalize">{a.action_type?.replace(/_/g, ' ')}</span>
                            <span className="text-text-muted text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-surface-light rounded">{a.target_type}</span>
                          </div>
                          {a.details && (
                            <p className="text-text-muted text-xs mt-0.5">
                              {a.details.reason && <span>Reason: {a.details.reason}</span>}
                              {a.details.amount && <span> &middot; {a.details.type}: {a.details.amount} {a.details.currency?.toUpperCase()}</span>}
                            </p>
                          )}
                          <p className="text-text-muted/60 text-[10px] mt-1 font-mono">
                            {a.target_id && `Target: ${a.target_id.slice(0, 12)}...`}
                            {a.created_at && ` · ${new Date(a.created_at).toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
