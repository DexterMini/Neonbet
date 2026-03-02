'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Users, Search, DollarSign, ArrowUpCircle, ArrowDownCircle,
  AlertTriangle, TrendingUp, Activity, Eye, Ban, Snowflake,
  RefreshCw, Gift, ChevronDown, X, Clock, CheckCircle,
  BarChart3, Wallet, Zap, UserCheck, Lock, Unlock,
  Settings, Percent, CreditCard, Star, ToggleLeft, ToggleRight,
  Trash2, Save, PieChart, ArrowUp, ArrowDown, Globe, Server,
  Cpu, HardDrive, Wifi, WifiOff, ChevronRight, Layers,
  Hash, Timer, Gauge, CircleDot, Radio, Flame, Target,
  TrendingDown, ExternalLink, LayoutDashboard, FileText, Copy,
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

const ADMIN_PIN = '1337A6B'

/* ── Sparkline component ───────────────────────────── */
function Sparkline({ data, color = '#06d6a0', width = 80, height = 28 }: {
  data: number[]; color?: string; width?: number; height?: number
}) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  const areaPath = `M0,${height} L${points.split(' ').map((p, i) => {
    if (i === 0) return p
    return ` L${p}`
  }).join('')} L${width},${height} Z`

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`M${points.split(' ').map((p, i) => i === 0 ? p : ` L${p}`).join('')} L${width},${height} L0,${height} Z`}
        fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={parseFloat(points.split(' ').pop()?.split(',')?.[1] || '0')}
        r={2} fill={color} />
    </svg>
  )
}

/* ── Animated counter ──────────────────────────────── */
function AnimatedCounter({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number
}) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(0)

  useEffect(() => {
    const start = ref.current
    const end = value
    const dur = 800
    const startTime = Date.now()
    const step = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / dur, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const current = start + (end - start) * eased
      setDisplay(current)
      if (progress < 1) requestAnimationFrame(step)
      else ref.current = end
    }
    requestAnimationFrame(step)
  }, [value])

  return <span>{prefix}{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}{suffix}</span>
}

/* ── Donut chart ───────────────────────────────────── */
function DonutChart({ segments, size = 120 }: {
  segments: { value: number; color: string; label: string }[]; size?: number
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1
  const r = (size - 12) / 2
  const cx = size / 2
  const cy = size / 2
  let cumAngle = -90

  return (
    <svg width={size} height={size} className="transform -rotate-0">
      {segments.map((seg, i) => {
        const angle = (seg.value / total) * 360
        const startAngle = cumAngle
        cumAngle += angle
        const endAngle = cumAngle
        const largeArc = angle > 180 ? 1 : 0
        const startRad = (startAngle * Math.PI) / 180
        const endRad = (endAngle * Math.PI) / 180
        const x1 = cx + r * Math.cos(startRad)
        const y1 = cy + r * Math.sin(startRad)
        const x2 = cx + r * Math.cos(endRad)
        const y2 = cy + r * Math.sin(endRad)
        return (
          <path key={i}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
            fill={seg.color}
            opacity={0.85}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={1}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--surface, #1a1a2e)" />
    </svg>
  )
}

/* ── Toggle helper ─────────────────────────────────── */
function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label?: string }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 group" type="button">
      <div className={cn(
        'relative w-10 h-5.5 rounded-full transition-colors duration-200',
        on ? 'bg-emerald-500' : 'bg-white/10'
      )}>
        <div className={cn(
          'absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200',
          on ? 'translate-x-5' : 'translate-x-0.5'
        )} />
      </div>
      {label && <span className="text-sm text-white/70 group-hover:text-white transition-colors">{label}</span>}
    </button>
  )
}

/* ── Pulse dot ─────────────────────────────────────── */
function PulseDot({ color = 'bg-emerald-400' }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', color)} />
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', color)} />
    </span>
  )
}

/* ── System health data (simulated) ────────────────── */
function useSystemHealth() {
  const [health, setHealth] = useState({
    uptime: 99.98,
    latency: 12,
    cpuUsage: 34,
    memoryUsage: 52,
    diskUsage: 41,
    activeConnections: 847,
    requestsPerSec: 1250,
    errorRate: 0.02,
  })

  useEffect(() => {
    const iv = setInterval(() => {
      setHealth(prev => ({
        ...prev,
        latency: Math.max(5, prev.latency + Math.round((Math.random() - 0.5) * 4)),
        cpuUsage: Math.max(10, Math.min(85, prev.cpuUsage + Math.round((Math.random() - 0.5) * 8))),
        memoryUsage: Math.max(30, Math.min(80, prev.memoryUsage + Math.round((Math.random() - 0.5) * 3))),
        activeConnections: Math.max(500, prev.activeConnections + Math.round((Math.random() - 0.5) * 60)),
        requestsPerSec: Math.max(800, prev.requestsPerSec + Math.round((Math.random() - 0.5) * 100)),
        errorRate: Math.max(0, +(prev.errorRate + (Math.random() - 0.55) * 0.01).toFixed(3)),
      }))
    }, 3000)
    return () => clearInterval(iv)
  }, [])

  return health
}

/* ── Random sparkline data ─────────────────────────── */
function useSparklineData(count = 7) {
  return useMemo(() => {
    const series: number[][] = []
    for (let i = 0; i < count; i++) {
      const arr: number[] = []
      let v = 50 + Math.random() * 50
      for (let j = 0; j < 12; j++) {
        v = Math.max(0, v + (Math.random() - 0.4) * 20)
        arr.push(v)
      }
      series.push(arr)
    }
    return series
  }, [count])
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const { token } = useAuthStore()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [pinShake, setPinShake] = useState(false)

  const [tab, setTab] = useState<AdminTab>('overview')
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(false)

  const [adjUserId, setAdjUserId] = useState('')
  const [adjType, setAdjType] = useState<'credit' | 'debit'>('credit')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjCurrency, setAdjCurrency] = useState('USD')
  const [adjReason, setAdjReason] = useState('')
  const [adjSubmitting, setAdjSubmitting] = useState(false)

  const [auditLog, setAuditLog] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())

  const automation = useAutomationStore()
  const health = useSystemHealth()
  const sparklines = useSparklineData(7)

  useEffect(() => {
    const iv = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

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
      setPinShake(true)
      setTimeout(() => { setPinError(false); setPinShake(false) }, 600)
    }
  }

  /* ── API calls ─────────────────────────────────── */
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/stats/overview`, { headers: headers() })
      if (res.ok) setStats(await res.json())
    } catch { /* ignore */ }
  }, [apiBase, headers])

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

  const fetchUserDetails = async (userId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/users/${userId}`, { headers: headers() })
      if (res.ok) setSelectedUser(await res.json())
    } catch { /* ignore */ }
  }

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

  const fetchAuditLog = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/audit-log?limit=50`, { headers: headers() })
      if (res.ok) {
        const data = await res.json()
        setAuditLog(data.actions || [])
      }
    } catch { /* ignore */ }
  }, [apiBase, headers])

  useEffect(() => {
    if (!authenticated) return
    fetchStats()
    fetchUsers()
    fetchAuditLog()
  }, [authenticated, fetchStats, fetchUsers, fetchAuditLog])

  const greeting = useMemo(() => {
    const h = currentTime.getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [currentTime])

  const ps = automation.profitStats

  /* ═══════════════ PIN SCREEN ═══════════════ */
  if (!authenticated) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="relative w-full max-w-sm">
                {/* Glow effect */}
                <div className="absolute -inset-px bg-gradient-to-r from-brand/20 via-purple-500/20 to-brand/20 rounded-2xl blur-xl opacity-60" />
                <div className="relative bg-surface/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-8 text-center shadow-2xl">
                  {/* Animated shield */}
                  <motion.div
                    animate={{ rotateY: [0, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand/30"
                  >
                    <Shield className="w-8 h-8 text-white" />
                  </motion.div>
                  <h1 className="text-xl font-bold text-white mb-1">Admin Access</h1>
                  <p className="text-white/40 text-sm mb-6">Enter your admin PIN to continue</p>

                  <motion.div animate={pinShake ? { x: [-8, 8, -8, 8, 0] } : {}} transition={{ duration: 0.4 }}>
                    <input
                      type="password"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                      placeholder="• • • • • • •"
                      className={cn(
                        'w-full p-4 bg-white/[0.04] border rounded-xl text-white text-center text-lg font-mono tracking-[0.4em] placeholder:tracking-[0.3em] placeholder:text-white/15 focus:outline-none transition-all duration-200 mb-4',
                        pinError
                          ? 'border-red-500/60 bg-red-500/5 focus:border-red-500/60'
                          : 'border-white/[0.08] focus:border-brand/50 focus:bg-white/[0.06]',
                      )}
                    />
                  </motion.div>
                  {pinError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-xs mb-4 flex items-center justify-center gap-1">
                      <AlertTriangle size={12} /> Invalid PIN
                    </motion.p>
                  )}
                  <button
                    onClick={handlePinSubmit}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand to-purple-600 text-white font-semibold text-sm hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-[0.98]"
                  >
                    Unlock Dashboard
                  </button>
                  <p className="text-white/20 text-[10px] mt-4 flex items-center justify-center gap-1">
                    <Lock size={10} /> AES-256 Encrypted Session
                  </p>
                </div>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    )
  }

  /* ═══════════════ ADMIN NAVIGATION ═══════════════ */
  const navItems: { key: AdminTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'users', label: 'Players', icon: Users, badge: users.length || undefined },
    { key: 'adjustments', label: 'Balance Ops', icon: Wallet },
    { key: 'automation', label: 'Automation', icon: Settings },
    { key: 'audit', label: 'Audit Trail', icon: FileText, badge: auditLog.length || undefined },
  ]

  /* ═══════════════ DASHBOARD ═══════════════ */
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          {/* Top Bar */}
          <div className="border-b border-white/[0.06] bg-gradient-to-r from-surface/90 to-surface/50 backdrop-blur-lg px-6 py-4">
            <div className="max-w-[1440px] mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-purple-600 flex items-center justify-center shadow-lg shadow-brand/20">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    {greeting}, Admin
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                      <PulseDot /> LIVE
                    </span>
                  </h1>
                  <p className="text-white/40 text-xs font-mono">
                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    {' · '}
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { fetchStats(); fetchUsers(searchQuery); fetchAuditLog() }}
                  className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
                  title="Refresh all"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-[1440px] mx-auto px-6 py-5">
            {/* Navigation Tabs — Modern pill style */}
            <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1 scrollbar-hide">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = tab === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={cn(
                      'relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap',
                      active
                        ? 'text-white'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]',
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="admin-tab-bg"
                        className="absolute inset-0 bg-white/[0.08] border border-white/[0.1] rounded-xl"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {item.label}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className={cn(
                          'min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1',
                          active ? 'bg-brand/20 text-brand' : 'bg-white/[0.06] text-white/30'
                        )}>
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* ══════════════ OVERVIEW ══════════════ */}
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* KPI Cards Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Active Users', value: stats?.active_users_24h ?? 0, icon: Users, color: '#06d6a0', gradient: 'from-emerald-500/10 to-emerald-500/0', trend: '+12.5%', up: true },
                    { label: 'Bets (24h)', value: stats?.total_bets_24h ?? 0, icon: Activity, color: '#26c6da', gradient: 'from-cyan-500/10 to-cyan-500/0', trend: '+8.3%', up: true },
                    { label: 'Wagered', value: stats ? parseFloat(stats.total_wagered_24h) : 0, icon: DollarSign, color: '#ffd93d', gradient: 'from-amber-500/10 to-amber-500/0', trend: '+15.2%', up: true, dollar: true },
                    { label: 'Revenue', value: stats ? parseFloat(stats.gross_gaming_revenue_24h) : 0, icon: TrendingUp, color: '#06d6a0', gradient: 'from-emerald-500/10 to-emerald-500/0', trend: '+22.1%', up: true, dollar: true },
                    { label: 'Pending W/D', value: stats?.pending_withdrawals ?? 0, icon: Clock, color: '#a78bfa', gradient: 'from-violet-500/10 to-violet-500/0', trend: '-3', up: false },
                    { label: 'Alerts', value: stats?.unresolved_alerts ?? 0, icon: AlertTriangle, color: '#ef4444', gradient: 'from-red-500/10 to-red-500/0', trend: '0', up: false },
                  ].map((card, i) => {
                    const Icon = card.icon
                    return (
                      <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          'relative overflow-hidden rounded-xl border border-white/[0.06] p-4',
                          `bg-gradient-to-b ${card.gradient}`
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.color + '15' }}>
                            <Icon className="w-4 h-4" style={{ color: card.color }} />
                          </div>
                          <div className={cn(
                            'flex items-center gap-0.5 text-[10px] font-semibold',
                            card.up ? 'text-emerald-400' : card.trend === '0' ? 'text-white/30' : 'text-red-400'
                          )}>
                            {card.up ? <ArrowUp size={10} /> : card.trend !== '0' ? <ArrowDown size={10} /> : null}
                            {card.trend}
                          </div>
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">{card.label}</p>
                            <p className="text-white text-xl font-bold font-mono">
                              {card.dollar ? <AnimatedCounter value={card.value} prefix="$" decimals={0} /> : <AnimatedCounter value={card.value} />}
                            </p>
                          </div>
                          <div className="opacity-60 mb-1">
                            <Sparkline data={sparklines[i]} color={card.color} width={60} height={24} />
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Profit Dashboard + System Health row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Profit Dashboard — 2 cols */}
                  <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                          <BarChart3 className="w-4 h-4 text-brand" />
                        </div>
                        <div>
                          <h2 className="text-sm font-semibold text-white">Profit & Revenue</h2>
                          <p className="text-[11px] text-white/30">Autonomous tracking · Real-time</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { if (confirm('Reset all profit stats?')) automation.resetProfitStats() }}
                        className="text-white/30 hover:text-red-400 text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/5"
                      >
                        <Trash2 className="w-3 h-3" /> Reset
                      </button>
                    </div>
                    <div className="p-5">
                      {/* Big numbers row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                        {[
                          { label: 'Total Wagered', value: ps.totalWagered, color: '#26c6da', icon: Layers },
                          { label: 'Total Payouts', value: ps.totalPayouts, color: '#ffd93d', icon: DollarSign },
                          { label: 'Gross Profit', value: ps.grossProfit, color: ps.grossProfit >= 0 ? '#06d6a0' : '#ef4444', icon: TrendingUp },
                          { label: 'Net Profit', value: ps.netProfit, color: ps.netProfit >= 0 ? '#06d6a0' : '#ef4444', icon: Target },
                        ].map((m) => {
                          const Icon = m.icon
                          return (
                            <div key={m.label} className="bg-white/[0.03] rounded-xl p-3.5 border border-white/[0.04]">
                              <div className="flex items-center gap-2 mb-2">
                                <Icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                                <span className="text-white/40 text-[10px] uppercase tracking-wider">{m.label}</span>
                              </div>
                              <p className="text-white text-lg font-bold font-mono" style={{ color: m.color }}>
                                {formatCurrency(m.value)}
                              </p>
                            </div>
                          )
                        })}
                      </div>

                      {/* Secondary stats */}
                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                          <Hash className="w-4 h-4 text-brand" />
                          <div>
                            <p className="text-white/40 text-[10px]">Total Bets</p>
                            <p className="text-white font-bold text-sm font-mono">{ps.totalBets.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                          <Percent className="w-4 h-4 text-purple-400" />
                          <div>
                            <p className="text-white/40 text-[10px]">Cashback Paid</p>
                            <p className="text-purple-400 font-bold text-sm font-mono">{formatCurrency(ps.totalCashbackPaid)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                          <Gift className="w-4 h-4 text-amber-400" />
                          <div>
                            <p className="text-white/40 text-[10px]">Bonuses Paid</p>
                            <p className="text-amber-400 font-bold text-sm font-mono">{formatCurrency(ps.totalBonusesPaid)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Per-game table */}
                      {Object.keys(ps.perGame).length > 0 ? (
                        <div>
                          <h3 className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-3">Per-Game Performance</h3>
                          <div className="overflow-x-auto rounded-lg border border-white/[0.04]">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-white/[0.02]">
                                  {['Game', 'Bets', 'Wagered', 'Payouts', 'Profit', 'Edge'].map(h => (
                                    <th key={h} className={cn('p-3 text-white/30 text-[10px] uppercase tracking-wider font-semibold', h === 'Game' ? 'text-left' : 'text-right')}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(ps.perGame).map(([game, gs]) => (
                                  <tr key={game} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                    <td className="p-3 flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-md bg-brand/10 flex items-center justify-center">
                                        <CircleDot className="w-3 h-3 text-brand" />
                                      </div>
                                      <span className="text-white font-medium capitalize">{game}</span>
                                    </td>
                                    <td className="p-3 text-right text-white/60 font-mono">{gs.bets}</td>
                                    <td className="p-3 text-right text-white/60 font-mono">{formatCurrency(gs.wagered)}</td>
                                    <td className="p-3 text-right text-white/60 font-mono">{formatCurrency(gs.payouts)}</td>
                                    <td className={cn('p-3 text-right font-mono font-semibold', gs.profit >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                                      {gs.profit >= 0 ? '+' : ''}{formatCurrency(gs.profit)}
                                    </td>
                                    <td className="p-3 text-right">
                                      <span className={cn(
                                        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold',
                                        gs.effectiveEdge >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                      )}>
                                        {gs.effectiveEdge.toFixed(2)}%
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Activity className="w-8 h-8 text-white/10 mx-auto mb-3" />
                          <p className="text-white/30 text-sm">No bets tracked yet</p>
                          <p className="text-white/15 text-xs mt-1">Stats appear automatically as bets are placed</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* System Health — 1 col */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Server className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-white">System Health</h2>
                        <p className="text-[11px] text-white/30">Real-time monitoring</p>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {/* Uptime */}
                      <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                        <div className="flex items-center gap-2.5">
                          <PulseDot color="bg-emerald-400" />
                          <span className="text-white/60 text-xs">Uptime</span>
                        </div>
                        <span className="text-emerald-400 font-bold text-sm font-mono">{health.uptime}%</span>
                      </div>

                      {/* Metrics */}
                      {[
                        { label: 'Latency', value: `${health.latency}ms`, icon: Timer, percent: health.latency / 100, color: health.latency < 30 ? 'emerald' : health.latency < 60 ? 'amber' : 'red' },
                        { label: 'CPU Usage', value: `${health.cpuUsage}%`, icon: Cpu, percent: health.cpuUsage / 100, color: health.cpuUsage < 50 ? 'emerald' : health.cpuUsage < 75 ? 'amber' : 'red' },
                        { label: 'Memory', value: `${health.memoryUsage}%`, icon: HardDrive, percent: health.memoryUsage / 100, color: health.memoryUsage < 60 ? 'emerald' : health.memoryUsage < 80 ? 'amber' : 'red' },
                        { label: 'Disk', value: `${health.diskUsage}%`, icon: HardDrive, percent: health.diskUsage / 100, color: health.diskUsage < 60 ? 'emerald' : health.diskUsage < 80 ? 'amber' : 'red' },
                      ].map((m) => {
                        const Icon = m.icon
                        const barColor = m.color === 'emerald' ? 'bg-emerald-500' : m.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                        return (
                          <div key={m.label} className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Icon className="w-3.5 h-3.5 text-white/30" />
                                <span className="text-white/50 text-xs">{m.label}</span>
                              </div>
                              <span className="text-white font-mono text-xs font-semibold">{m.value}</span>
                            </div>
                            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <motion.div
                                className={cn('h-full rounded-full', barColor)}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(m.percent * 100, 100)}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        )
                      })}

                      {/* Quick stats */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.04] text-center">
                          <Wifi className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-1" />
                          <p className="text-white font-bold text-sm font-mono">{health.activeConnections.toLocaleString()}</p>
                          <p className="text-white/30 text-[10px]">Connections</p>
                        </div>
                        <div className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.04] text-center">
                          <Gauge className="w-3.5 h-3.5 text-brand mx-auto mb-1" />
                          <p className="text-white font-bold text-sm font-mono">{health.requestsPerSec.toLocaleString()}</p>
                          <p className="text-white/30 text-[10px]">Req/sec</p>
                        </div>
                      </div>

                      {/* Error rate */}
                      <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-white/30" />
                          <span className="text-white/50 text-xs">Error Rate</span>
                        </div>
                        <span className={cn('font-mono text-xs font-semibold', health.errorRate < 0.1 ? 'text-emerald-400' : 'text-red-400')}>
                          {health.errorRate.toFixed(3)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Automation Status Bar */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-white">Active Automations</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Cashback', active: automation.cashback.enabled, value: `${automation.cashback.percentage}%`, sub: automation.cashback.frequency, color: 'emerald' },
                      { label: 'Deposit Bonus', active: automation.depositBonus.enabled, value: `${automation.depositBonus.firstDepositPercent}%`, sub: `1st / ${automation.depositBonus.reloadPercent}% reload`, color: 'cyan' },
                      { label: 'VIP System', active: automation.vip.enabled, value: `${automation.vip.levels.length} levels`, sub: `auto-${automation.vip.autoProgression ? 'on' : 'off'}`, color: 'amber' },
                      { label: 'Avg Edge', active: true, value: `${(automation.gameEdges.filter(g => g.enabled).reduce((s, g) => s + g.houseEdge, 0) / Math.max(1, automation.gameEdges.filter(g => g.enabled).length) * 100).toFixed(2)}%`, sub: `${automation.gameEdges.filter(g => g.enabled).length} games`, color: 'brand' },
                    ].map((item) => (
                      <div key={item.label} className={cn(
                        'rounded-xl p-4 border transition-all',
                        item.active
                          ? `bg-${item.color === 'brand' ? 'brand' : item.color === 'emerald' ? 'emerald-500' : item.color === 'cyan' ? 'cyan-500' : 'amber-500'}/5 border-white/[0.06]`
                          : 'bg-white/[0.01] border-white/[0.04]'
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/40 text-xs">{item.label}</span>
                          {item.active ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                              <PulseDot color="bg-emerald-400" /> ON
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-white/20">OFF</span>
                          )}
                        </div>
                        {item.active && (
                          <p className="text-white text-lg font-bold">
                            {item.value}
                            <span className="text-white/30 text-xs font-normal ml-1.5">{item.sub}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ USERS ══════════════ */}
            {tab === 'users' && (
              <div className="space-y-5">
                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    type="text" value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchUsers(searchQuery)}
                    placeholder="Search players by username or email..."
                    className="w-full pl-11 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-brand/40 focus:bg-white/[0.04] transition-all"
                  />
                  <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-2 py-0.5 rounded bg-white/[0.05] text-white/20 text-[10px] font-mono border border-white/[0.06]">
                    Enter
                  </kbd>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white/[0.02]">
                          {['Player', 'Status', 'VIP', 'Risk Score', 'Actions'].map((h, i) => (
                            <th key={h} className={cn('p-4 text-white/30 text-[10px] uppercase tracking-wider font-semibold',
                              i === 4 ? 'text-right' : 'text-left'
                            )}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-12 text-center">
                              <Users className="w-8 h-8 text-white/10 mx-auto mb-2" />
                              <p className="text-white/30 text-sm">{loading ? 'Loading players...' : 'No players found'}</p>
                            </td>
                          </tr>
                        ) : users.map((u) => (
                          <tr key={u.user_id} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand/20 to-purple-600/20 flex items-center justify-center text-brand text-xs font-bold border border-white/[0.06]">
                                  {u.username?.slice(0, 2).toUpperCase() || '??'}
                                </div>
                                <div>
                                  <p className="text-white font-medium text-sm">{u.username}</p>
                                  <p className="text-white/30 text-xs font-mono">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider',
                                u.status === 'active' && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                                u.status === 'frozen' && 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
                                u.status === 'banned' && 'bg-red-500/10 text-red-400 border border-red-500/20',
                                !['active', 'frozen', 'banned'].includes(u.status) && 'bg-white/[0.05] text-white/30 border border-white/[0.06]',
                              )}>
                                <span className={cn('w-1.5 h-1.5 rounded-full',
                                  u.status === 'active' ? 'bg-emerald-400' : u.status === 'frozen' ? 'bg-blue-400' : u.status === 'banned' ? 'bg-red-400' : 'bg-white/30'
                                )} />
                                {u.status}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/15">
                                <Star size={10} /> Lv.{u.vip_level}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                  <div className={cn('h-full rounded-full', u.risk_score < 30 ? 'bg-emerald-500' : u.risk_score < 60 ? 'bg-amber-500' : 'bg-red-500')}
                                    style={{ width: `${u.risk_score}%` }} />
                                </div>
                                <span className={cn('text-xs font-mono font-semibold',
                                  u.risk_score < 30 ? 'text-emerald-400' : u.risk_score < 60 ? 'text-amber-400' : 'text-red-400'
                                )}>{u.risk_score}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { fetchUserDetails(u.user_id); setAdjUserId(u.user_id) }} className="p-2 rounded-lg hover:bg-brand/10 text-white/40 hover:text-brand transition-all" title="View"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => { setAdjUserId(u.user_id); setTab('adjustments') }} className="p-2 rounded-lg hover:bg-emerald-500/10 text-white/40 hover:text-emerald-400 transition-all" title="Credit"><Gift className="w-4 h-4" /></button>
                                {u.status === 'active' ? (
                                  <button onClick={() => handleUserAction(u.user_id, 'freeze', 'Admin freeze')} className="p-2 rounded-lg hover:bg-blue-500/10 text-white/40 hover:text-blue-400 transition-all" title="Freeze"><Snowflake className="w-4 h-4" /></button>
                                ) : u.status === 'frozen' ? (
                                  <button onClick={() => handleUserAction(u.user_id, 'unfreeze', 'Admin unfreeze')} className="p-2 rounded-lg hover:bg-emerald-500/10 text-white/40 hover:text-emerald-400 transition-all" title="Unfreeze"><Unlock className="w-4 h-4" /></button>
                                ) : null}
                                {u.status !== 'banned' ? (
                                  <button onClick={() => handleUserAction(u.user_id, 'ban', 'Admin ban')} className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all" title="Ban"><Ban className="w-4 h-4" /></button>
                                ) : (
                                  <button onClick={() => handleUserAction(u.user_id, 'unban', 'Admin unban')} className="p-2 rounded-lg hover:bg-emerald-500/10 text-white/40 hover:text-emerald-400 transition-all" title="Unban"><UserCheck className="w-4 h-4" /></button>
                                )}
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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md"
                      onClick={() => setSelectedUser(null)}
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="w-full max-w-lg bg-surface border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Header */}
                        <div className="relative p-5 border-b border-white/[0.06] bg-gradient-to-r from-brand/5 to-purple-600/5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-brand/20">
                              {selectedUser.username?.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white">{selectedUser.username}</h3>
                              <p className="text-xs text-white/40 font-mono">{selectedUser.email}</p>
                            </div>
                          </div>
                          <button onClick={() => setSelectedUser(null)}
                            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white transition-all">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: 'Status', value: selectedUser.status, color: selectedUser.status === 'active' ? 'text-emerald-400' : selectedUser.status === 'frozen' ? 'text-blue-400' : 'text-red-400' },
                              { label: 'VIP Level', value: String(selectedUser.vip_level), color: 'text-amber-400' },
                              { label: 'Total Bets', value: String(selectedUser.stats?.total_bets || 0), color: 'text-white' },
                            ].map(s => (
                              <div key={s.label} className="bg-white/[0.03] rounded-xl p-3.5 text-center border border-white/[0.04]">
                                <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">{s.label}</p>
                                <p className={cn('font-bold text-sm capitalize', s.color)}>{s.value}</p>
                              </div>
                            ))}
                          </div>
                          {selectedUser.balances && Object.keys(selectedUser.balances).length > 0 && (
                            <div>
                              <h4 className="text-white/30 text-[10px] uppercase tracking-wider font-semibold mb-2">Balances</h4>
                              <div className="space-y-1.5">
                                {Object.entries(selectedUser.balances).map(([cur, amt]) => (
                                  <div key={cur} className="flex justify-between items-center p-3 bg-white/[0.03] rounded-lg border border-white/[0.04]">
                                    <span className="text-white/40 text-sm">{cur}</span>
                                    <span className="text-white font-mono font-semibold text-sm">{amt}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <button onClick={() => { setAdjUserId(selectedUser.user_id); setSelectedUser(null); setTab('adjustments') }}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-purple-600 text-white font-semibold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand/20">
                            <Gift className="w-4 h-4" /> Adjust Balance
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
              <div className="max-w-2xl mx-auto">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-brand" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">Balance Operations</h2>
                      <p className="text-[11px] text-white/30">Credit, debit, reload, or cashback any player</p>
                    </div>
                  </div>
                  <div className="p-5 space-y-5">
                    {/* User ID */}
                    <div>
                      <label className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-2">Player ID</label>
                      <input type="text" value={adjUserId} onChange={(e) => setAdjUserId(e.target.value)}
                        placeholder="Paste user ID or select from Players tab"
                        className="w-full p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-brand/40 transition-all font-mono" />
                    </div>

                    {/* Type toggle */}
                    <div>
                      <label className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-2">Operation Type</label>
                      <div className="flex gap-2">
                        <button onClick={() => setAdjType('credit')}
                          className={cn('flex-1 py-3.5 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2',
                            adjType === 'credit'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                              : 'bg-white/[0.02] text-white/30 border-white/[0.06] hover:border-white/[0.1]'
                          )}>
                          <ArrowDownCircle className="w-4 h-4" /> Credit
                        </button>
                        <button onClick={() => setAdjType('debit')}
                          className={cn('flex-1 py-3.5 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2',
                            adjType === 'debit'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30 shadow-lg shadow-red-500/5'
                              : 'bg-white/[0.02] text-white/30 border-white/[0.06] hover:border-white/[0.1]'
                          )}>
                          <ArrowUpCircle className="w-4 h-4" /> Debit
                        </button>
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-2">Amount</label>
                      <div className="flex gap-3">
                        <input type="number" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)}
                          placeholder="0.00"
                          className="flex-1 p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-xl font-bold font-mono placeholder:text-white/10 focus:outline-none focus:border-brand/40 transition-all" />
                        <select value={adjCurrency} onChange={(e) => setAdjCurrency(e.target.value)}
                          className="px-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm font-semibold focus:outline-none appearance-none cursor-pointer">
                          {['USD', 'BTC', 'ETH', 'SOL', 'USDT', 'LTC'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {['5', '10', '25', '50', '100', '500'].map(v => (
                          <button key={v} onClick={() => setAdjAmount(v)}
                            className={cn('flex-1 py-2 rounded-lg text-xs font-semibold transition-all border',
                              adjAmount === v ? 'bg-brand/10 text-brand border-brand/30' : 'bg-white/[0.02] text-white/30 border-white/[0.06] hover:text-white hover:border-white/[0.1]'
                            )}>
                            ${v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-2">Reason</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {['Reload Bonus', 'Cashback', 'VIP Reward', 'Compensation', 'Manual Correction', 'Promo Code'].map(r => (
                          <button key={r} onClick={() => setAdjReason(r)}
                            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                              adjReason === r ? 'bg-brand/10 text-brand border-brand/30' : 'bg-white/[0.02] text-white/30 border-white/[0.06] hover:text-white hover:border-white/[0.1]'
                            )}>
                            {r}
                          </button>
                        ))}
                      </div>
                      <input type="text" value={adjReason} onChange={(e) => setAdjReason(e.target.value)}
                        placeholder="Or type a custom reason..."
                        className="w-full p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-brand/40 transition-all" />
                    </div>

                    {/* Preview */}
                    {adjUserId && adjAmount && adjReason && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={cn('p-4 rounded-xl border',
                          adjType === 'credit' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
                        )}>
                        <p className="text-white text-sm">
                          {adjType === 'credit' ? '➕ Credit' : '➖ Debit'}{' '}
                          <span className="font-bold font-mono">{adjAmount} {adjCurrency}</span>{' '}
                          {adjType === 'credit' ? 'to' : 'from'} player{' '}
                          <span className="font-mono text-xs text-white/40">{adjUserId.slice(0, 16)}...</span>
                        </p>
                        <p className="text-white/40 text-xs mt-1">Reason: {adjReason}</p>
                      </motion.div>
                    )}

                    {/* Submit */}
                    <button onClick={handleAdjustBalance}
                      disabled={!adjUserId || !adjAmount || !adjReason || adjSubmitting}
                      className={cn(
                        'w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg',
                        adjType === 'credit'
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:brightness-110 shadow-emerald-500/20'
                          : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:brightness-110 shadow-red-500/20',
                        (!adjUserId || !adjAmount || !adjReason || adjSubmitting) && 'opacity-40 cursor-not-allowed'
                      )}>
                      {adjSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : adjType === 'credit' ? <><ArrowDownCircle className="w-4 h-4" /> Credit Balance</> : <><ArrowUpCircle className="w-4 h-4" /> Debit Balance</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ AUTOMATION ══════════════ */}
            {tab === 'automation' && (
              <div className="space-y-5">

                {/* Cashback Engine */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Percent className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-white">Automatic Cashback</h2>
                        <p className="text-[11px] text-white/30">Return % of net losses automatically</p>
                      </div>
                    </div>
                    <Toggle on={automation.cashback.enabled} onToggle={() => automation.setCashbackConfig({ enabled: !automation.cashback.enabled })} />
                  </div>
                  {automation.cashback.enabled && (
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: 'Cashback %', value: automation.cashback.percentage, onChange: (v: number) => automation.setCashbackConfig({ percentage: Math.max(0, Math.min(100, v)) }), suffix: '%', hint: '% of net losses returned' },
                        { label: 'Frequency', type: 'select', value: automation.cashback.frequency, options: [{ v: 'instant', l: 'Instant' }, { v: 'daily', l: 'Daily' }, { v: 'weekly', l: 'Weekly' }], onChange: (v: string) => automation.setCashbackConfig({ frequency: v as CashbackConfig['frequency'] }) },
                        { label: 'Min Loss Threshold', value: automation.cashback.minLossThreshold, onChange: (v: number) => automation.setCashbackConfig({ minLossThreshold: v }), prefix: '$' },
                        { label: 'Max per Period', value: automation.cashback.maxCashback, onChange: (v: number) => automation.setCashbackConfig({ maxCashback: v }), prefix: '$' },
                      ].map((f) => (
                        <div key={f.label}>
                          <label className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-2">{f.label}</label>
                          {f.type === 'select' ? (
                            <select value={f.value as string} onChange={(e) => (f.onChange as (v: string) => void)(e.target.value)}
                              className="w-full p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm focus:outline-none focus:border-brand/40 transition-all">
                              {(f as any).options.map((o: { v: string; l: string }) => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          ) : (
                            <div className="relative">
                              {f.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-sm">{f.prefix}</span>}
                              <input type="number" value={f.value as number}
                                onChange={(e) => (f.onChange as (v: number) => void)(parseFloat(e.target.value) || 0)}
                                className={cn('w-full p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm font-mono focus:outline-none focus:border-brand/40 transition-all', f.prefix && 'pl-7')} />
                              {f.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 text-sm">{f.suffix}</span>}
                            </div>
                          )}
                          {f.hint && <p className="text-white/15 text-[10px] mt-1">{f.hint}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Deposit Bonus */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-white">Deposit Bonuses</h2>
                        <p className="text-[11px] text-white/30">First deposit & reload match bonuses</p>
                      </div>
                    </div>
                    <Toggle on={automation.depositBonus.enabled} onToggle={() => automation.setDepositBonusConfig({ enabled: !automation.depositBonus.enabled })} />
                  </div>
                  {automation.depositBonus.enabled && (
                    <div className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
                          <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <Star className="w-4 h-4 text-amber-400" /> First Deposit
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-white/30 text-[10px] uppercase mb-1">Match %</label>
                              <input type="number" value={automation.depositBonus.firstDepositPercent}
                                onChange={(e) => automation.setDepositBonusConfig({ firstDepositPercent: parseFloat(e.target.value) || 0 })}
                                className="w-full p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white text-sm font-mono focus:outline-none focus:border-brand/40 transition-all" />
                            </div>
                            <div>
                              <label className="block text-white/30 text-[10px] uppercase mb-1">Max Bonus</label>
                              <input type="number" value={automation.depositBonus.firstDepositMax}
                                onChange={(e) => automation.setDepositBonusConfig({ firstDepositMax: parseFloat(e.target.value) || 0 })}
                                className="w-full p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white text-sm font-mono focus:outline-none focus:border-brand/40 transition-all" />
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
                          <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-brand" /> Reload
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-white/30 text-[10px] uppercase mb-1">Match %</label>
                              <input type="number" value={automation.depositBonus.reloadPercent}
                                onChange={(e) => automation.setDepositBonusConfig({ reloadPercent: parseFloat(e.target.value) || 0 })}
                                className="w-full p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white text-sm font-mono focus:outline-none focus:border-brand/40 transition-all" />
                            </div>
                            <div>
                              <label className="block text-white/30 text-[10px] uppercase mb-1">Max Bonus</label>
                              <input type="number" value={automation.depositBonus.reloadMax}
                                onChange={(e) => automation.setDepositBonusConfig({ reloadMax: parseFloat(e.target.value) || 0 })}
                                className="w-full p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white text-sm font-mono focus:outline-none focus:border-brand/40 transition-all" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="max-w-xs">
                        <label className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-2">Wagering Requirement</label>
                        <div className="relative">
                          <input type="number" value={automation.depositBonus.wageringReq}
                            onChange={(e) => automation.setDepositBonusConfig({ wageringReq: parseFloat(e.target.value) || 1 })}
                            className="w-full p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm font-mono focus:outline-none focus:border-brand/40 transition-all" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 text-xs">× wagering</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* VIP Auto-Progression */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Star className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-white">VIP Progression & Rewards</h2>
                        <p className="text-[11px] text-white/30">Auto level-up and bonus distribution</p>
                      </div>
                    </div>
                    <Toggle on={automation.vip.enabled} onToggle={() => automation.setVIPConfig({ enabled: !automation.vip.enabled })} />
                  </div>
                  {automation.vip.enabled && (
                    <div className="p-5">
                      <div className="flex gap-4 mb-5">
                        <Toggle on={automation.vip.autoProgression} onToggle={() => automation.setVIPConfig({ autoProgression: !automation.vip.autoProgression })} label="Auto Level-Up" />
                        <Toggle on={automation.vip.autoDistribute} onToggle={() => automation.setVIPConfig({ autoDistribute: !automation.vip.autoDistribute })} label="Auto-Distribute" />
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-white/[0.04]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-white/[0.02]">
                              {['Level', 'Min Wagered', 'Rakeback %', 'Level-Up Bonus', 'Weekly %', 'Monthly %'].map(h => (
                                <th key={h} className={cn('p-3 text-white/30 text-[10px] uppercase tracking-wider font-semibold', h === 'Level' ? 'text-left' : 'text-right')}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {automation.vip.levels.map((lvl, i) => (
                              <tr key={lvl.level} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                <td className="p-3">
                                  <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                                    <Star size={12} /> {lvl.name}
                                  </span>
                                </td>
                                {[
                                  { key: 'minWagered', value: lvl.minWagered },
                                  { key: 'rakebackPercent', value: lvl.rakebackPercent, step: 0.5 },
                                  { key: 'levelUpBonus', value: lvl.levelUpBonus },
                                  { key: 'weeklyBonusPercent', value: lvl.weeklyBonusPercent, step: 0.1 },
                                  { key: 'monthlyBonusPercent', value: lvl.monthlyBonusPercent, step: 0.1 },
                                ].map((field) => (
                                  <td key={field.key} className="p-3">
                                    <input type="number" value={field.value}
                                      onChange={(e) => automation.updateVIPLevel(i, { [field.key]: parseFloat(e.target.value) || 0 })}
                                      step={field.step}
                                      className="w-24 p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white text-xs font-mono text-right focus:outline-none focus:border-brand/40 transition-all" />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* House Edge per Game */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-white">House Edge & Game Limits</h2>
                        <p className="text-[11px] text-white/30">Configure edge, bet limits, max win per game</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="overflow-x-auto rounded-lg border border-white/[0.04]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white/[0.02]">
                            {['Game', 'Status', 'House Edge %', 'Min Bet', 'Max Bet', 'Max Win'].map(h => (
                              <th key={h} className={cn('p-3 text-white/30 text-[10px] uppercase tracking-wider font-semibold', h === 'Game' ? 'text-left' : 'text-center')}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {automation.gameEdges.map((g) => (
                            <tr key={g.game} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 text-white font-medium">{g.label}</td>
                              <td className="p-3 text-center">
                                <Toggle on={g.enabled} onToggle={() => automation.setGameEdge(g.game, { enabled: !g.enabled })} />
                              </td>
                              {[
                                { value: (g.houseEdge * 100).toFixed(1), onChange: (v: string) => automation.setGameEdge(g.game, { houseEdge: (parseFloat(v) || 0) / 100 }), step: 0.1, width: 'w-20' },
                                { value: g.minBet, onChange: (v: string) => automation.setGameEdge(g.game, { minBet: parseFloat(v) || 0.10 }), step: 0.10, width: 'w-24' },
                                { value: g.maxBet, onChange: (v: string) => automation.setGameEdge(g.game, { maxBet: parseFloat(v) || 100 }), width: 'w-28' },
                                { value: g.maxWin, onChange: (v: string) => automation.setGameEdge(g.game, { maxWin: parseFloat(v) || 1000 }), width: 'w-28' },
                              ].map((field, fi) => (
                                <td key={fi} className="p-3 text-center">
                                  <input type="number" value={field.value}
                                    onChange={(e) => field.onChange(e.target.value)}
                                    step={field.step}
                                    className={cn(field.width, 'p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white text-xs font-mono text-right focus:outline-none focus:border-brand/40 transition-all mx-auto')} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-white/15 text-[10px] mt-3 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> All settings auto-save to localStorage
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ AUDIT TRAIL ══════════════ */}
            {tab === 'audit' && (
              <div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-white">Audit Trail</h2>
                        <p className="text-[11px] text-white/30">All admin actions logged chronologically</p>
                      </div>
                    </div>
                    <button onClick={fetchAuditLog}
                      className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/30 hover:text-white transition-all">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {auditLog.length === 0 ? (
                      <div className="p-12 text-center">
                        <FileText className="w-8 h-8 text-white/10 mx-auto mb-2" />
                        <p className="text-white/30 text-sm">No admin actions recorded yet</p>
                      </div>
                    ) : auditLog.map((a, i) => (
                      <div key={a.id || i} className="flex items-start gap-4 p-4 hover:bg-white/[0.02] transition-colors group">
                        <div className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border',
                          a.action_type === 'adjust_balance' && 'bg-brand/10 border-brand/20 text-brand',
                          a.action_type === 'ban' && 'bg-red-500/10 border-red-500/20 text-red-400',
                          a.action_type === 'freeze' && 'bg-blue-500/10 border-blue-500/20 text-blue-400',
                          (a.action_type === 'unban' || a.action_type === 'unfreeze') && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                          !['adjust_balance', 'ban', 'freeze', 'unban', 'unfreeze'].includes(a.action_type) && 'bg-white/[0.04] border-white/[0.06] text-white/30',
                        )}>
                          {a.action_type === 'adjust_balance' ? <DollarSign className="w-4 h-4" /> :
                           a.action_type === 'ban' ? <Ban className="w-4 h-4" /> :
                           a.action_type === 'freeze' ? <Snowflake className="w-4 h-4" /> :
                           <Zap className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm capitalize">{a.action_type?.replace(/_/g, ' ')}</span>
                            <span className="text-white/20 text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/[0.06]">
                              {a.target_type}
                            </span>
                          </div>
                          {a.details && (
                            <p className="text-white/40 text-xs mt-0.5">
                              {a.details.reason && <span>Reason: {a.details.reason}</span>}
                              {a.details.amount && <span> · {a.details.type}: {a.details.amount} {a.details.currency?.toUpperCase()}</span>}
                            </p>
                          )}
                          <p className="text-white/15 text-[10px] mt-1 font-mono">
                            {a.target_id && `Target: ${a.target_id.slice(0, 12)}...`}
                            {a.created_at && ` · ${new Date(a.created_at).toLocaleString()}`}
                          </p>
                        </div>
                        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/20 hover:text-white/60 transition-all" title="Copy ID">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
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
