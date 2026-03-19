'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Settings, History, Shield,
  LogOut, Copy, Check, ChevronRight, Camera,
  Wallet, TrendingUp, Gamepad2, Star, Clock,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { Sidebar } from '@/components/Sidebar'
import { Button, Badge } from '@/components/ui'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { MobileNav } from '@/components/MobileNav'
import { toast } from 'sonner'

interface BetStats {
  total_bets: number
  total_wagered: string
  net_profit: string
  win_rate: number
}

interface BetRecord {
  bet_id: string
  game_type: string
  bet_amount: string
  outcome: string
  multiplier: string
  payout: string
  profit: string
  timestamp: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, token, isAuthenticated, isHydrated, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [copied, setCopied] = useState(false)

  // Live data
  const [stats, setStats] = useState<BetStats | null>(null)
  const [recentBets, setRecentBets] = useState<BetRecord[]>([])
  const [allBets, setAllBets] = useState<BetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [changingUsername, setChangingUsername] = useState(false)
  const [lastUsernameChange, setLastUsernameChange] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('lastUsernameChange')
    return null
  })

  const authHeaders = useCallback((): Record<string, string> =>
    token ? { Authorization: `Bearer ${token}` } : {}, [token])

  // Redirect if not authenticated (after hydration)
  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, router])

  // Fetch stats + recent bets
  useEffect(() => {
    if (!token) return
    setLoading(true)
    const headers = authHeaders()
    Promise.all([
      fetch('/api/v1/bets/stats/summary', { headers }).then(r => r.ok ? r.json() : null),
      fetch('/api/v1/bets/history?page=1&per_page=5', { headers }).then(r => r.ok ? r.json() : null),
    ]).then(([s, h]) => {
      if (s) setStats(s)
      if (h?.bets) setRecentBets(h.bets)
    }).finally(() => setLoading(false))
  }, [token, authHeaders])

  // Fetch full history when tab switches
  useEffect(() => {
    if (activeTab !== 'history' || !token || allBets.length > 0) return
    fetch('/api/v1/bets/history?page=1&per_page=50', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.bets) setAllBets(d.bets) })
  }, [activeTab, token, authHeaders])

  // Show nothing while checking auth or if not authenticated
  if (!isHydrated || (isHydrated && !isAuthenticated) || !user) {
    return null
  }

  const userId = (() => {
    const raw = user.id || ''
    return `CE-${raw.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  })()

  const copyUserId = () => {
    navigator.clipboard.writeText(userId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statCards = [
    { label: 'Total Wagered', value: stats ? formatCurrency(parseFloat(stats.total_wagered)) : '—', icon: Wallet },
    { label: 'Net Profit', value: stats ? (parseFloat(stats.net_profit) >= 0 ? '+' : '') + formatCurrency(parseFloat(stats.net_profit)) : '—', icon: TrendingUp },
    { label: 'Games Played', value: stats ? stats.total_bets.toLocaleString() : '—', icon: Gamepad2 },
    { label: 'Win Rate', value: stats ? `${(stats.win_rate * 100).toFixed(1)}%` : '—', icon: Star },
  ]

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'history', label: 'Bet History', icon: History },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-mobile-nav">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-h2 text-text-primary">Profile</h1>
              <p className="text-small text-text-muted mt-1">Manage your account and view your stats</p>
            </div>

            <div className="grid lg:grid-cols-[280px,1fr] gap-6">
              {/* Profile Sidebar */}
              <div className="space-y-4">
                {/* Profile Card */}
                <div className="bg-surface rounded-xl p-6 border border-border">
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    <div className="w-full h-full rounded-xl bg-brand/10 flex items-center justify-center text-3xl font-bold text-brand">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <button className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-brand rounded-full flex items-center justify-center text-background hover:bg-brand-light transition-colors">
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-center">
                    <h2 className="text-base font-semibold text-text-primary mb-0.5">{user.username}</h2>
                    <p className="text-text-muted text-xs mb-3">{user.email}</p>

                    <div className="flex items-center justify-center gap-2 bg-background rounded-lg p-2">
                      <span className="text-text-muted text-xs font-mono">{userId}</span>
                      <button onClick={copyUserId} className="text-text-muted hover:text-text-primary transition-colors">
                        {copied ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted text-xs">VIP Level</span>
                      <Badge variant="brand" size="sm">{user.vip_level || 0}</Badge>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="bg-surface rounded-xl p-1.5 border border-border">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors',
                        activeTab === tab.id
                          ? 'bg-brand/10 text-brand font-medium'
                          : 'text-text-muted hover:text-text-primary hover:bg-surface-light'
                      )}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                      <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                    </button>
                  ))}

                  <div className="border-t border-border mt-1.5 pt-1.5">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-accent-red hover:bg-accent-red/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Log Out
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="space-y-6">
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' && (
                    <motion.div
                      key="overview"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      {/* Stats Grid */}
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {statCards.map((stat, i) => (
                          <div
                            key={i}
                            className="bg-surface rounded-xl p-5 border border-border"
                          >
                            <div className="w-10 h-10 rounded-lg bg-brand/[0.08] flex items-center justify-center mb-3">
                              <stat.icon className="w-5 h-5 text-brand" />
                            </div>
                            <p className="text-text-muted text-xs">{stat.label}</p>
                            <p className="text-lg font-bold text-text-primary">{stat.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* VIP Progress */}
                      <div className="bg-surface rounded-xl p-6 border border-border">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-semibold text-text-primary">VIP Progress</h3>
                          <Link href="/vip" className="text-brand text-xs font-medium hover:underline">
                            View Benefits
                          </Link>
                        </div>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-14 h-14 rounded-xl bg-brand/10 flex items-center justify-center">
                            <Star className="w-7 h-7 text-brand" />
                          </div>
                          <div>
                            <p className="text-text-primary font-semibold">Level {user.vip_level || 0}</p>
                            <p className="text-text-muted text-xs">
                              {stats ? formatCurrency(parseFloat(stats.total_wagered)) : '$0'} wagered
                            </p>
                          </div>
                        </div>
                        <div className="w-full bg-background rounded-full h-2">
                          <div className="bg-brand h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (stats ? parseFloat(stats.total_wagered) / 15000 * 100 : 0))}%` }} />
                        </div>
                      </div>

                      {/* Recent Bets */}
                      <div className="bg-surface rounded-xl border border-border overflow-hidden">
                        <div className="p-5 border-b border-border flex items-center justify-between">
                          <h3 className="text-base font-semibold text-text-primary">Recent Bets</h3>
                          <button
                            onClick={() => setActiveTab('history')}
                            className="text-brand text-xs font-medium hover:underline"
                          >
                            View All
                          </button>
                        </div>
                        <div className="divide-y divide-border">
                          {recentBets.length === 0 && !loading && (
                            <div className="p-8 text-center text-text-muted text-sm">No bets yet</div>
                          )}
                          {recentBets.map((bet, i) => {
                            const profitVal = parseFloat(bet.profit || '0')
                            const isWin = profitVal >= 0
                            return (
                            <div key={bet.bet_id || i} className="flex items-center justify-between p-4 hover:bg-surface-light transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-brand/[0.08] flex items-center justify-center">
                                  <Gamepad2 className="w-5 h-5 text-brand" />
                                </div>
                                <div>
                                  <p className="text-text-primary font-medium text-sm capitalize">{bet.game_type}</p>
                                  <p className="text-text-muted text-xs flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {bet.timestamp ? timeAgo(bet.timestamp) : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={cn(
                                  'font-semibold text-sm',
                                  isWin ? 'text-accent-green' : 'text-accent-red'
                                )}>
                                  {isWin ? '+' : ''}{formatCurrency(profitVal)}
                                </p>
                                <p className="text-text-muted text-xs font-mono">{parseFloat(bet.multiplier).toFixed(2)}x</p>
                              </div>
                            </div>
                            )
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'history' && (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-surface rounded-xl border border-border"
                    >
                      <div className="p-5 border-b border-border">
                        <h3 className="text-base font-semibold text-text-primary">Bet History</h3>
                        <p className="text-text-muted text-xs mt-0.5">All your bets in one place</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-text-muted text-xs border-b border-border">
                              <th className="p-4 font-medium">Game</th>
                              <th className="p-4 font-medium">Bet Amount</th>
                              <th className="p-4 font-medium">Multiplier</th>
                              <th className="p-4 font-medium">Profit</th>
                              <th className="p-4 font-medium">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(allBets.length > 0 ? allBets : recentBets).map((bet, i) => {
                              const profitVal = parseFloat(bet.profit || '0')
                              const isWin = profitVal >= 0
                              return (
                              <tr key={bet.bet_id || i} className="border-b border-border hover:bg-surface-light transition-colors">
                                <td className="p-4 text-text-primary text-sm capitalize">{bet.game_type}</td>
                                <td className="p-4 text-text-primary text-sm">{formatCurrency(parseFloat(bet.bet_amount))}</td>
                                <td className="p-4 text-brand text-sm font-mono">{parseFloat(bet.multiplier).toFixed(2)}x</td>
                                <td className={cn(
                                  'p-4 font-semibold text-sm',
                                  isWin ? 'text-accent-green' : 'text-accent-red'
                                )}>
                                  {isWin ? '+' : ''}{formatCurrency(profitVal)}
                                </td>
                                <td className="p-4 text-text-muted text-sm">{bet.timestamp ? timeAgo(bet.timestamp) : ''}</td>
                              </tr>
                              )
                            })}
                            {recentBets.length === 0 && allBets.length === 0 && (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-text-muted text-sm">No bets yet</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'security' && (
                    <motion.div
                      key="security"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      {[
                        { title: 'Two-Factor Authentication', desc: 'Add an extra layer of security', enabled: false },
                        { title: 'Email Notifications', desc: 'Get notified about important activities', enabled: true },
                        { title: 'Login Alerts', desc: 'Get alerted on new device logins', enabled: true },
                      ].map((item, i) => (
                        <div key={i} className="bg-surface rounded-xl p-5 border border-border flex items-center justify-between">
                          <div>
                            <p className="text-text-primary font-medium text-sm">{item.title}</p>
                            <p className="text-text-muted text-xs">{item.desc}</p>
                          </div>
                          <button
                            className={cn(
                              'w-11 h-6 rounded-full transition-colors',
                              item.enabled ? 'bg-brand' : 'bg-border-light'
                            )}
                          >
                            <div className={cn(
                              'w-5 h-5 bg-white rounded-full transition-transform',
                              item.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                            )} />
                          </button>
                        </div>
                      ))}

                      <div className="bg-surface rounded-xl p-6 border border-border">
                        <h3 className="text-base font-semibold text-text-primary mb-4">Change Password</h3>
                        <form className="space-y-3" onSubmit={async (e) => {
                          e.preventDefault()
                          if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
                          if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
                          setChangingPw(true)
                          try {
                            const res = await fetch('/api/v1/auth/change-password', {
                              method: 'POST',
                              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                              body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
                            })
                            if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.detail || 'Failed') }
                            toast.success('Password updated')
                            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
                          } catch (err: any) { toast.error(err?.message || 'Failed') }
                          finally { setChangingPw(false) }
                        }}>
                          <input
                            type="password"
                            placeholder="Current password"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg py-2.5 px-4 text-text-primary text-sm placeholder:text-text-muted/40 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-colors"
                          />
                          <input
                            type="password"
                            placeholder="New password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg py-2.5 px-4 text-text-primary text-sm placeholder:text-text-muted/40 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-colors"
                          />
                          <input
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg py-2.5 px-4 text-text-primary text-sm placeholder:text-text-muted/40 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-colors"
                          />
                          <Button type="submit" loading={changingPw} disabled={changingPw}>Update Password</Button>
                        </form>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'settings' && (
                    <motion.div
                      key="settings"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-surface rounded-xl p-6 border border-border"
                    >
                      <h3 className="text-base font-semibold text-text-primary mb-6">Account Settings</h3>
                      <div className="space-y-5">
                        <div>
                          <label className="block text-text-muted text-xs font-medium mb-2">Username</label>
                          {(() => {
                            const canChange = !lastUsernameChange || (Date.now() - new Date(lastUsernameChange).getTime()) > 365 * 24 * 60 * 60 * 1000
                            const nextChangeDate = lastUsernameChange ? new Date(new Date(lastUsernameChange).getTime() + 365 * 24 * 60 * 60 * 1000) : null
                            return (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder={user.username}
                                    value={newUsername}
                                    onChange={e => setNewUsername(e.target.value)}
                                    disabled={!canChange || changingUsername}
                                    className={cn(
                                      'flex-1 bg-background border border-border rounded-lg py-2.5 px-4 text-sm transition-colors',
                                      canChange
                                        ? 'text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20'
                                        : 'text-text-secondary cursor-not-allowed opacity-70'
                                    )}
                                  />
                                  <button
                                    onClick={async () => {
                                      if (!newUsername.trim() || newUsername.trim() === user.username) { toast.error('Enter a new username'); return }
                                      if (newUsername.trim().length < 3) { toast.error('Username must be at least 3 characters'); return }
                                      if (newUsername.trim().length > 20) { toast.error('Username must be 20 characters or less'); return }
                                      setChangingUsername(true)
                                      try {
                                        const res = await fetch('/api/v1/auth/change-username', {
                                          method: 'POST',
                                          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ new_username: newUsername.trim() }),
                                        })
                                        if (!res.ok) {
                                          const err = await res.json().catch(() => null)
                                          throw new Error(err?.detail || 'Failed to change username')
                                        }
                                        const now = new Date().toISOString()
                                        localStorage.setItem('lastUsernameChange', now)
                                        localStorage.setItem('displayUsername', newUsername.trim())
                                        setLastUsernameChange(now)
                                        toast.success(`Username changed to ${newUsername.trim()}`)
                                        setNewUsername('')
                                      } catch (err: any) { toast.error(err?.message || 'Failed to change username') }
                                      finally { setChangingUsername(false) }
                                    }}
                                    disabled={!canChange || changingUsername || !newUsername.trim()}
                                    className="px-4 py-2.5 bg-brand text-background rounded-lg text-sm font-semibold hover:bg-brand-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                  >
                                    {changingUsername ? 'Saving...' : 'Change'}
                                  </button>
                                </div>
                                <p className="text-text-muted text-2xs">
                                  {canChange
                                    ? 'You can change your username once per year'
                                    : `Next change available ${nextChangeDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                  }
                                </p>
                              </div>
                            )
                          })()}
                        </div>
                        <div>
                          <label className="block text-text-muted text-xs font-medium mb-2">Email</label>
                          <input
                            type="email"
                            value={user.email}
                            readOnly
                            className="w-full bg-background border border-border rounded-lg py-2.5 px-4 text-text-secondary text-sm cursor-not-allowed opacity-70"
                          />
                        </div>
                        <div>
                          <label className="block text-text-muted text-xs font-medium mb-2">Language</label>
                          <select className="w-full bg-background border border-border rounded-lg py-2.5 px-4 text-text-primary text-sm focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-colors">
                            <option>English</option>
                            <option>Norwegian</option>
                            <option>Spanish</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-text-muted text-xs font-medium mb-2">Currency</label>
                          <select className="w-full bg-background border border-border rounded-lg py-2.5 px-4 text-text-primary text-sm focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-colors">
                            <option>USD ($)</option>
                            <option>EUR (&euro;)</option>
                            <option>BTC (&#x20BF;)</option>
                          </select>
                        </div>
                        <p className="text-text-muted text-xs mt-2">Language and currency preferences are stored locally.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </main>
        <MobileNav />
      </div>
    </div>
  )
}
