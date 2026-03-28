"use client"

import { cn } from "@/lib/utils"
import { useCasinoStore } from "@/lib/store"
import { 
  Home, Star, Clock, Zap, Dice1, Target, Tv, 
  Trophy, Award, Gift, Crown, ChevronLeft,
  ChevronRight, Users, LayoutDashboard, Gamepad2,
  Flame, MessageCircle, Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const mainNavItems = [
  { id: "lobby", icon: Home, label: "Lobby" },
  { id: "favorites", icon: Star, label: "Favorites" },
  { id: "recent", icon: Clock, label: "Recently Played" },
]

const casinoNavItems = [
  { id: "originals", icon: Zap, label: "Originals", badge: "HOT" },
  { id: "slots", icon: Dice1, label: "Slots" },
  { id: "live", icon: Tv, label: "Live Casino", badge: "LIVE" },
  { id: "game-shows", icon: Gamepad2, label: "Game Shows" },
  { id: "table", icon: Target, label: "Table Games" },
]

const originalsNavItems = [
  { id: "dice", icon: Dice1, label: "Dice" },
  { id: "limbo", icon: Target, label: "Limbo" },
  { id: "crash", icon: Flame, label: "Crash" },
  { id: "plinko", icon: Sparkles, label: "Plinko" },
]

const communityNavItems = [
  { id: "leaderboard", icon: Trophy, label: "Leaderboard" },
  { id: "achievements", icon: Award, label: "Achievements" },
  { id: "promotions", icon: Gift, label: "Promotions", badge: "3" },
  { id: "vip", icon: Crown, label: "VIP Club" },
]

export function CasinoSidebar() {
  const { 
    sidebarCollapsed, 
    setSidebarCollapsed, 
    currentView, 
    setCurrentView,
    user,
    onlineUsers 
  } = useCasinoStore()

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full flex flex-col bg-sidebar/80 backdrop-blur-xl border-r border-sidebar-border transition-all duration-300 z-50",
      sidebarCollapsed ? "w-[72px]" : "w-[260px]"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#00a07a] flex items-center justify-center overflow-hidden">
          <Zap className="w-5 h-5 text-primary-foreground relative z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-foreground">
              Celora
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Casino
            </span>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-20 -right-3 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border z-10 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>

      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {/* Main Navigation */}
        <NavSection items={mainNavItems} collapsed={sidebarCollapsed} />

        {/* Casino */}
        <NavSection 
          title="CASINO" 
          items={casinoNavItems} 
          collapsed={sidebarCollapsed} 
        />

        {/* Originals */}
        <NavSection 
          title="ORIGINALS" 
          items={originalsNavItems} 
          collapsed={sidebarCollapsed} 
        />

        {/* Community */}
        <NavSection 
          title="COMMUNITY" 
          items={communityNavItems} 
          collapsed={sidebarCollapsed} 
        />

        {/* Admin - Only visible to admins */}
        {user?.isAdmin && (
          <div className="px-3">
            {!sidebarCollapsed && (
              <div className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
                Admin
              </div>
            )}
            <button
              onClick={() => setCurrentView(currentView === "admin" ? "lobby" : "admin")}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all",
                currentView === "admin" 
                  ? "bg-primary/10 text-primary neon-glow" 
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
                sidebarCollapsed && "justify-center"
              )}
            >
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="text-sm font-medium">Dashboard</span>}
            </button>
          </div>
        )}
      </div>

      {/* Daily Race Promo */}
      {!sidebarCollapsed && (
        <div className="mx-3 mb-4 p-4 rounded-2xl glass-light neon-border">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Daily Race</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            $10,000 prize pool. Wager to climb the leaderboard.
          </p>
          <div className="gold-shimmer text-2xl font-bold tracking-tight">$10,000</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{onlineUsers.toLocaleString()} competing</span>
          </div>
        </div>
      )}

      {/* Live Support */}
      <div className="p-3 border-t border-sidebar-border">
        <button className={cn(
          "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all",
          sidebarCollapsed && "justify-center"
        )}>
          <div className="relative">
            <MessageCircle className="w-5 h-5" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full live-pulse" />
          </div>
          {!sidebarCollapsed && <span className="text-sm">Live Support</span>}
        </button>
      </div>
    </aside>
  )
}

interface NavSectionProps {
  title?: string
  items: Array<{
    id: string
    icon: React.ElementType
    label: string
    badge?: string
  }>
  collapsed: boolean
}

function NavSection({ title, items, collapsed }: NavSectionProps) {
  const { currentView, setCurrentView } = useCasinoStore()
  
  return (
    <div className="px-3">
      {title && !collapsed && (
        <div className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
          {title}
        </div>
      )}
      <nav className="space-y-1">
        {items.map((item) => {
          const isActive = item.id === "lobby" && currentView === "lobby"
          
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "lobby") setCurrentView("lobby")
              }}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all group",
                isActive 
                  ? "bg-primary text-primary-foreground font-medium neon-glow" 
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
                collapsed && "justify-center"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0 transition-transform",
                !isActive && "group-hover:scale-110"
              )} />
              {!collapsed && (
                <>
                  <span className="text-sm flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <Badge 
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0 font-bold",
                        item.badge === "LIVE" && "bg-destructive/20 text-destructive border-destructive/30 live-pulse",
                        item.badge === "HOT" && "bg-orange-500/20 text-orange-400 border-orange-500/30",
                        item.badge === "3" && "bg-primary/20 text-primary border-primary/30"
                      )}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
