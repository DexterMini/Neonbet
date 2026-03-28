"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LayoutDashboard, Users, Wallet, Settings, Bot, FileText,
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  Activity, Clock, Server, Cpu, HardDrive, Wifi,
  RefreshCw, Search, Star, Gift, CreditCard, Zap,
  ArrowUpRight, ArrowDownRight, MoreHorizontal
} from "lucide-react"
import { useCasinoStore, CELORA_GAMES, VIP_LEVELS } from "@/lib/store"

type AdminTab = "overview" | "players" | "balance" | "settings" | "automation" | "audit"

export function AdminPanel() {
  const { user } = useCasinoStore()
  const [activeTab, setActiveTab] = useState<AdminTab>("overview")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "players", label: "Players", icon: Users },
    { id: "balance", label: "Balance Ops", icon: Wallet },
    { id: "settings", label: "Game Settings", icon: Settings },
    { id: "automation", label: "Automation", icon: Bot },
    { id: "audit", label: "Audit Trail", icon: FileText },
  ]

  const greeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-[#00a07a] flex items-center justify-center overflow-hidden">
            <LayoutDashboard className="w-7 h-7 text-primary-foreground relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{greeting()}, {user?.username}</h1>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-400 mr-2 live-pulse"></span>
                LIVE
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {currentTime.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} · {currentTime.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          className="rounded-xl border-border"
          onClick={handleRefresh}
        >
          <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "glass-light border border-primary/30 text-foreground neon-glow"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "players" && <PlayersTab />}
        {activeTab === "balance" && <BalanceOpsTab />}
        {activeTab === "settings" && <GameSettingsTab />}
        {activeTab === "automation" && <AutomationTab />}
        {activeTab === "audit" && <AuditTrailTab />}
      </div>
    </div>
  )
}

function OverviewTab() {
  const [liveStats, setLiveStats] = useState({
    activeUsers: 1247,
    bets24h: 8492,
    wagered: 142847,
    revenue: 12547,
    pendingWithdrawals: 23,
    alerts: 2,
  })

  // Simulate live stat updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStats(prev => ({
        activeUsers: Math.max(0, prev.activeUsers + Math.floor((Math.random() - 0.5) * 50)),
        bets24h: Math.max(0, prev.bets24h + Math.floor((Math.random() - 0.3) * 20)),
        wagered: Math.max(0, prev.wagered + Math.floor((Math.random() - 0.3) * 500)),
        revenue: Math.max(0, prev.revenue + Math.floor((Math.random() - 0.4) * 100)),
        pendingWithdrawals: Math.max(0, Math.min(50, prev.pendingWithdrawals + Math.floor((Math.random() - 0.5) * 3))),
        alerts: prev.alerts,
      }))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const stats = [
    { label: "ACTIVE USERS", value: liveStats.activeUsers.toLocaleString(), change: "+12.5%", trend: "up", icon: Users, color: "text-blue-400", bgColor: "from-blue-500/20 to-blue-600/10" },
    { label: "BETS (24H)", value: liveStats.bets24h.toLocaleString(), change: "+8.3%", trend: "up", icon: Activity, color: "text-purple-400", bgColor: "from-purple-500/20 to-purple-600/10" },
    { label: "WAGERED", value: `$${liveStats.wagered.toLocaleString()}`, change: "+15.2%", trend: "up", icon: DollarSign, color: "text-primary", bgColor: "from-primary/20 to-primary/10" },
    { label: "REVENUE", value: `$${liveStats.revenue.toLocaleString()}`, change: "+22.1%", trend: "up", icon: TrendingUp, color: "text-green-400", bgColor: "from-green-500/20 to-green-600/10" },
    { label: "PENDING W/D", value: liveStats.pendingWithdrawals.toString(), change: "-3", trend: "down", icon: Clock, color: "text-amber-400", bgColor: "from-amber-500/20 to-amber-600/10" },
    { label: "ALERTS", value: liveStats.alerts.toString(), change: "", trend: "neutral", icon: AlertTriangle, color: "text-destructive", bgColor: "from-destructive/20 to-destructive/10" },
  ]

  const gamePerformance = CELORA_GAMES.slice(0, 5).map(game => ({
    name: game.name,
    bets: Math.floor(Math.random() * 3000) + 500,
    wagered: Math.floor(Math.random() * 80000) + 10000,
    payouts: 0,
    profit: 0,
    edge: game.houseEdge,
  })).map(game => ({
    ...game,
    payouts: Math.floor(game.wagered * (1 - game.edge / 100)),
    profit: Math.floor(game.wagered * (game.edge / 100)),
  }))

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.label} 
            className={cn(
              "relative p-5 rounded-2xl glass overflow-hidden group hover:scale-[1.02] transition-transform cursor-default"
            )}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", stat.bgColor)} />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-background/50", stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
                {stat.change && (
                  <div className={cn(
                    "flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-lg",
                    stat.trend === "up" ? "text-green-400 bg-green-500/10" : 
                    stat.trend === "down" ? "text-red-400 bg-red-500/10" : "text-muted-foreground"
                  )}>
                    {stat.trend === "up" && <ArrowUpRight className="w-3 h-3" />}
                    {stat.trend === "down" && <ArrowDownRight className="w-3 h-3" />}
                    {stat.change}
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profit & Revenue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-2xl glass">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Profit & Revenue</h3>
                  <p className="text-xs text-muted-foreground">Real-time tracking</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground rounded-xl">
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { label: "TOTAL WAGERED", value: `$${(liveStats.wagered * 1.5).toLocaleString()}`, color: "text-primary" },
                { label: "TOTAL PAYOUTS", value: `$${Math.floor(liveStats.wagered * 1.4).toLocaleString()}`, color: "text-amber-400" },
                { label: "GROSS PROFIT", value: `+$${Math.floor(liveStats.wagered * 0.1).toLocaleString()}`, color: "text-green-400" },
                { label: "NET PROFIT", value: `+$${Math.floor(liveStats.wagered * 0.08).toLocaleString()}`, color: "text-green-400" },
              ].map((item) => (
                <div key={item.label} className="p-4 rounded-xl glass-light">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{item.label}</div>
                  <div className={cn("text-xl font-bold font-mono", item.color)}>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-4">Per-Game Performance</div>
            <div className="overflow-x-auto rounded-xl glass-light">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-[10px] uppercase tracking-wider border-b border-border">
                    <th className="text-left p-4">Game</th>
                    <th className="text-right p-4">Bets</th>
                    <th className="text-right p-4">Wagered</th>
                    <th className="text-right p-4">Payouts</th>
                    <th className="text-right p-4">Profit</th>
                    <th className="text-right p-4">Edge</th>
                  </tr>
                </thead>
                <tbody>
                  {gamePerformance.map((game) => (
                    <tr key={game.name} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                          <span className="font-medium">{game.name}</span>
                        </div>
                      </td>
                      <td className="text-right p-4 text-muted-foreground font-mono">{game.bets.toLocaleString()}</td>
                      <td className="text-right p-4 text-muted-foreground font-mono">${game.wagered.toLocaleString()}</td>
                      <td className="text-right p-4 text-muted-foreground font-mono">${game.payouts.toLocaleString()}</td>
                      <td className="text-right p-4 text-green-400 font-mono">+${game.profit.toLocaleString()}</td>
                      <td className="text-right p-4">
                        <Badge variant="outline" className="text-green-400 border-green-400/30 font-mono">
                          {game.edge.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="p-6 rounded-2xl glass">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Server className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">System Health</h3>
              <p className="text-xs text-muted-foreground">Real-time monitoring</p>
            </div>
          </div>

          <div className="space-y-5">
            <HealthMetric label="Uptime" value="99.98%" color="green" />
            <HealthMetric label="Latency" value="13ms" color="green" />
            <HealthMetric label="CPU Usage" value="33%" progress={33} color="green" />
            <HealthMetric label="Memory" value="52%" progress={52} color="yellow" />
            <HealthMetric label="Disk" value="41%" progress={41} color="green" />
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div className="text-center p-4 rounded-xl glass-light">
                <Wifi className="w-5 h-5 mx-auto text-primary mb-2" />
                <div className="text-xl font-bold font-mono">858</div>
                <div className="text-[10px] text-muted-foreground uppercase">Connections</div>
              </div>
              <div className="text-center p-4 rounded-xl glass-light">
                <Activity className="w-5 h-5 mx-auto text-primary mb-2" />
                <div className="text-xl font-bold font-mono">1,287</div>
                <div className="text-[10px] text-muted-foreground uppercase">Req/sec</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl glass-light">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Error Rate</span>
              </div>
              <span className="text-sm text-green-400 font-mono">0.016%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HealthMetric({ label, value, progress, color }: { 
  label: string
  value: string
  progress?: number
  color: "green" | "yellow" | "red"
}) {
  const colorMap = {
    green: "bg-green-400",
    yellow: "bg-yellow-400", 
    red: "bg-red-400"
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {!progress && <div className={cn("w-2 h-2 rounded-full", colorMap[color])}></div>}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      {progress !== undefined ? (
        <div className="flex items-center gap-3 flex-1 max-w-[160px] ml-4">
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", colorMap[color])} style={{ width: `${progress}%` }}></div>
          </div>
          <span className="text-sm font-medium font-mono w-12 text-right">{value}</span>
        </div>
      ) : (
        <span className={cn("text-sm font-medium font-mono", color === "green" ? "text-green-400" : color === "yellow" ? "text-yellow-400" : "text-red-400")}>
          {value}
        </span>
      )}
    </div>
  )
}

function PlayersTab() {
  const [searchQuery, setSearchQuery] = useState("")
  
  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search players by username or email..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 h-12 bg-secondary/50 border-0 rounded-xl"
        />
      </div>

      <div className="rounded-2xl glass overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left p-5">Player</th>
              <th className="text-left p-5">Status</th>
              <th className="text-left p-5">VIP</th>
              <th className="text-left p-5">Risk Score</th>
              <th className="text-right p-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-16 text-center">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground">No players found</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Players will appear here when they register</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BalanceOpsTab() {
  const [operation, setOperation] = useState<"credit" | "debit">("credit")
  const [currency, setCurrency] = useState("USD")
  const [amount, setAmount] = useState("")
  const [selectedReason, setSelectedReason] = useState("")

  const currencies = ["USD", "BTC", "ETH", "SOL", "USDT", "LTC"]
  const quickAmounts = [5, 10, 25, 50, 100, 250, 500, 1000]
  const reasons = [
    { id: "reload", icon: Gift, label: "Reload Bonus", color: "text-green-400" },
    { id: "cashback", icon: DollarSign, label: "Cashback", color: "text-amber-400" },
    { id: "vip", icon: Star, label: "VIP Reward", color: "text-purple-400" },
    { id: "comp", icon: Gift, label: "Compensation", color: "text-pink-400" },
    { id: "manual", icon: Settings, label: "Manual Correction", color: "text-blue-400" },
    { id: "promo", icon: CreditCard, label: "Promo Code", color: "text-orange-400" },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Stats */}
      <div className="lg:col-span-3 grid grid-cols-4 gap-4">
        {[
          { label: "CREDITS (SESSION)", value: "$0.00", icon: TrendingUp, color: "border-green-500/30", iconColor: "text-green-400" },
          { label: "DEBITS (SESSION)", value: "$0.00", icon: TrendingDown, color: "border-red-500/30", iconColor: "text-red-400" },
          { label: "OPERATIONS", value: "0", icon: Activity, color: "border-blue-500/30", iconColor: "text-blue-400" },
          { label: "UNIQUE PLAYERS", value: "0", icon: Users, color: "border-purple-500/30", iconColor: "text-purple-400" },
        ].map((stat) => (
          <div key={stat.label} className={cn("p-5 rounded-2xl glass border", stat.color)}>
            <stat.icon className={cn("w-5 h-5 mb-4", stat.iconColor)} />
            <div className="text-2xl font-bold font-mono">{stat.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Balance Operation Form */}
      <div className="lg:col-span-2 p-6 rounded-2xl glass">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Balance Operation</h3>
            <p className="text-xs text-muted-foreground">{"Credit, debit, or adjust any player's balance"}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Target Player</label>
            <Input placeholder="Search by username or email..." className="h-12 bg-secondary/50 border-0 rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 block">Operation</label>
              <div className="flex gap-2">
                <Button
                  variant={operation === "credit" ? "default" : "outline"}
                  className={cn(
                    "flex-1 h-12 rounded-xl",
                    operation === "credit" && "bg-primary text-primary-foreground neon-glow"
                  )}
                  onClick={() => setOperation("credit")}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Credit
                </Button>
                <Button
                  variant={operation === "debit" ? "default" : "outline"}
                  className={cn(
                    "flex-1 h-12 rounded-xl",
                    operation === "debit" && "bg-destructive text-destructive-foreground"
                  )}
                  onClick={() => setOperation("debit")}
                >
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Debit
                </Button>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 block">Currency</label>
              <div className="flex gap-1.5">
                {currencies.map((cur) => (
                  <button
                    key={cur}
                    onClick={() => setCurrency(cur)}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-xs font-semibold transition-all",
                      currency === cur
                        ? "bg-primary text-primary-foreground"
                        : "glass-light text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 block">Amount</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="$ 0.00"
              className="h-16 bg-secondary/50 border-0 rounded-xl text-3xl font-mono text-center"
            />
            <div className="flex gap-2 mt-3">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className="flex-1 py-2.5 rounded-xl glass-light text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 block">Reason</label>
            <div className="flex flex-wrap gap-2">
              {reasons.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                    selectedReason === reason.id
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "glass-light text-muted-foreground hover:text-foreground"
                  )}
                >
                  <reason.icon className={cn("w-4 h-4", selectedReason === reason.id ? "text-primary" : reason.color)} />
                  {reason.label}
                </button>
              ))}
            </div>
            <Input 
              placeholder="Or type a custom reason..." 
              className="mt-3 h-12 bg-secondary/50 border-0 rounded-xl"
            />
          </div>

          <Button 
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-lg neon-glow"
            disabled={!amount}
          >
            <TrendingUp className="w-5 h-5 mr-2" />
            {operation === "credit" ? "Credit" : "Debit"} Balance
          </Button>
        </div>
      </div>

      {/* Recent Operations & Quick Actions */}
      <div className="space-y-6">
        <div className="p-6 rounded-2xl glass">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold">Recent Operations</h3>
            </div>
            <span className="text-xs text-muted-foreground">0 this session</span>
          </div>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No operations yet this session</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl glass">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "$10 Reload", desc: "Quick bonus credit", icon: Gift, color: "text-green-400" },
              { label: "$25 Cashback", desc: "Loss compensation", icon: DollarSign, color: "text-amber-400" },
              { label: "$50 VIP", desc: "VIP reward credit", icon: Star, color: "text-purple-400" },
              { label: "$100 Prize", desc: "Tournament payout", icon: Trophy, color: "text-pink-400" },
            ].map((action) => (
              <button 
                key={action.label}
                className="p-4 rounded-xl glass-light hover:bg-white/[0.05] transition-colors text-left group"
              >
                <action.icon className={cn("w-5 h-5 mb-2", action.color)} />
                <div className="font-medium text-sm">{action.label}</div>
                <div className="text-[10px] text-muted-foreground">{action.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function GameSettingsTab() {
  const [gameSettings, setGameSettings] = useState(
    CELORA_GAMES.map(game => ({
      ...game,
      enabled: true,
    }))
  )

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl glass">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Game RTP Settings</h3>
            <p className="text-xs text-muted-foreground">Adjust Return to Player % and House Edge for each game</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl glass-light">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="text-left p-5">Game</th>
                <th className="text-center p-5">Status</th>
                <th className="text-center p-5">House Edge %</th>
                <th className="text-center p-5">Min Bet</th>
                <th className="text-center p-5">Max Bet</th>
                <th className="text-center p-5">Max Win</th>
              </tr>
            </thead>
            <tbody>
              {gameSettings.map((game, index) => (
                <tr key={game.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="p-5">
                    <span className="font-medium">{game.name}</span>
                  </td>
                  <td className="p-5 text-center">
                    <Switch 
                      checked={game.enabled}
                      onCheckedChange={(checked) => {
                        const newSettings = [...gameSettings]
                        newSettings[index].enabled = checked
                        setGameSettings(newSettings)
                      }}
                    />
                  </td>
                  <td className="p-5">
                    <Input 
                      type="number" 
                      defaultValue={game.houseEdge} 
                      className="w-20 h-10 text-center bg-secondary/50 border-0 rounded-lg mx-auto"
                    />
                  </td>
                  <td className="p-5">
                    <Input 
                      type="number" 
                      defaultValue={game.minBet} 
                      className="w-20 h-10 text-center bg-secondary/50 border-0 rounded-lg mx-auto"
                    />
                  </td>
                  <td className="p-5">
                    <Input 
                      type="number" 
                      defaultValue={game.maxBet} 
                      className="w-24 h-10 text-center bg-secondary/50 border-0 rounded-lg mx-auto"
                    />
                  </td>
                  <td className="p-5">
                    <Input 
                      type="number" 
                      defaultValue={game.maxWin} 
                      className="w-28 h-10 text-center bg-secondary/50 border-0 rounded-lg mx-auto"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIP Settings */}
      <div className="p-6 rounded-2xl glass">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Star className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">VIP Progression & Rewards</h3>
            <p className="text-xs text-muted-foreground">Auto level-up and bonus distribution</p>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch />
              <span className="text-sm">Auto Level-Up</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch />
              <span className="text-sm">Auto-Distribute</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl glass-light">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="text-left p-5">Level</th>
                <th className="text-center p-5">Min Wagered</th>
                <th className="text-center p-5">Rakeback %</th>
                <th className="text-center p-5">Level-Up Bonus</th>
                <th className="text-center p-5">Weekly %</th>
                <th className="text-center p-5">Monthly %</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(VIP_LEVELS).map(([level, config]) => (
                <tr key={level} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="p-5">
                    <span className={cn(
                      "font-semibold capitalize",
                      level === "bronze" && "text-orange-400",
                      level === "silver" && "text-gray-400",
                      level === "gold" && "text-yellow-400",
                      level === "platinum" && "text-cyan-400",
                      level === "diamond" && "text-purple-400",
                      level === "vip" && "text-pink-400",
                      level === "svip" && "text-red-400",
                    )}>
                      <Star className="w-4 h-4 inline mr-2" />
                      {level.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-5">
                    <Input 
                      type="number" 
                      defaultValue={config.minWager} 
                      className="w-28 h-10 text-center bg-secondary/50 border-0 rounded-lg mx-auto"
                    />
                  </td>
                  <td className="p-5">
                    <Input 
                      type="number" 
                      defaultValue={config.rakeback} 
                      className="w-20 h-10 text-center bg-secondary/50 border-0 rounded-lg mx-auto"
                    />
                  </td>
                  <td className="p-5">
                    <Input 
                      type="number" 
                      defaultValue={config.levelUpBonus} 
                      className="w-24 h-10 text-center bg-secondary/50 border-0 rounded-lg mx-auto"
                    />
                  </td>
                  <td className="p-5">
                    <Input 
                      type="number" 
                      defaultValue={config.weeklyBonus} 
                      step="0.1"
                      className="w-20 h-10 text-center bg-secondary/50 border-0 rounded-lg mx-auto"
                    />
                  </td>
                  <td className="p-5">
                    <Input 
                      type="number" 
                      defaultValue={config.monthlyBonus} 
                      step="0.1"
                      className="w-20 h-10 text-center bg-secondary/50 border-0 rounded-lg mx-auto"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pro Tips */}
      <div className="p-5 rounded-xl glass-light border border-amber-500/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-400 mb-2">Pro Tips:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Higher RTP = more favorable to players, lower house profit</li>
              <li>RTP + House Edge = 100%</li>
              <li>Changes apply immediately to all new bets</li>
              <li>All changes are logged in the audit trail</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function AutomationTab() {
  const [cashbackEnabled, setCashbackEnabled] = useState(false)
  const [depositBonusEnabled, setDepositBonusEnabled] = useState(false)

  return (
    <div className="space-y-6">
      {/* Automatic Cashback */}
      <div className="p-6 rounded-2xl glass">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Automatic Cashback</h3>
              <p className="text-xs text-muted-foreground">Return % of net losses automatically</p>
            </div>
          </div>
          <Switch checked={cashbackEnabled} onCheckedChange={setCashbackEnabled} />
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Cashback %</label>
            <div className="relative">
              <Input type="number" defaultValue={10} className="h-12 bg-secondary/50 border-0 rounded-xl pr-8" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">% of net losses returned</p>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Frequency</label>
            <Select defaultValue="daily">
              <SelectTrigger className="h-12 bg-secondary/50 border-0 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Min Loss Threshold</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input type="number" defaultValue={5} className="h-12 bg-secondary/50 border-0 rounded-xl pl-8" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Max Per Period</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input type="number" defaultValue={2000} className="h-12 bg-secondary/50 border-0 rounded-xl pl-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Bonuses */}
      <div className="p-6 rounded-2xl glass">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Gift className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Deposit Bonuses</h3>
              <p className="text-xs text-muted-foreground">First deposit & reload match bonuses</p>
            </div>
          </div>
          <Switch checked={depositBonusEnabled} onCheckedChange={setDepositBonusEnabled} />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="p-5 rounded-xl glass-light">
            <div className="flex items-center gap-3 mb-4">
              <Star className="w-5 h-5 text-amber-400" />
              <h4 className="font-semibold">First Deposit</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Match %</label>
                <Input type="number" defaultValue={100} className="h-10 bg-secondary/50 border-0 rounded-lg" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Max Bonus</label>
                <Input type="number" defaultValue={500} className="h-10 bg-secondary/50 border-0 rounded-lg" />
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl glass-light">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="w-5 h-5 text-cyan-400" />
              <h4 className="font-semibold">Reload</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Match %</label>
                <Input type="number" defaultValue={25} className="h-10 bg-secondary/50 border-0 rounded-lg" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Max Bonus</label>
                <Input type="number" defaultValue={200} className="h-10 bg-secondary/50 border-0 rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Wagering Requirement</label>
          <div className="flex items-center gap-3 max-w-xs">
            <Input type="number" defaultValue={30} className="h-12 bg-secondary/50 border-0 rounded-xl" />
            <span className="text-muted-foreground whitespace-nowrap">x wagering</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AuditTrailTab() {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl glass">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Audit Trail</h3>
            <p className="text-xs text-muted-foreground">All admin actions logged chronologically</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl glass-light">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">No admin actions recorded yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Actions will appear here as they occur</p>
        </div>
      </div>
    </div>
  )
}
