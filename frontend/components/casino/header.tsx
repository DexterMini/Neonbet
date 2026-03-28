"use client"

import { useState, useEffect } from "react"
import { Search, Bell, Wallet, ChevronDown, Plus, MessageCircle, Settings, LogOut, User, History, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useCasinoStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function CasinoHeader({ onSignIn }: { onSignIn?: () => void }) {
  const { user, onlineUsers, logout, isAuthenticated } = useCasinoStore()
  const [notifications] = useState(3)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [searchFocused, setSearchFocused] = useState(false)

  const getVipColor = (level: string) => {
    const colors: Record<string, string> = {
      bronze: "text-orange-400 border-orange-400/30",
      silver: "text-gray-400 border-gray-400/30",
      gold: "text-yellow-400 border-yellow-400/30",
      platinum: "text-cyan-400 border-cyan-400/30",
      diamond: "text-purple-400 border-purple-400/30",
      vip: "text-pink-400 border-pink-400/30",
      svip: "text-red-400 border-red-400/30 neon-glow-gold",
    }
    return colors[level] || colors.bronze
  }

  return (
    <header className="h-16 border-b border-border glass sticky top-0 z-40 flex items-center px-6 gap-4">
      {/* Mode Switcher */}
      <div className="flex items-center glass-light rounded-xl p-1">
        <button className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-all">
          Casino
        </button>
        <button className="px-5 py-2 rounded-lg text-muted-foreground text-sm font-medium hover:text-foreground transition-all">
          Sports
        </button>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-lg">
        <div className={cn(
          "relative transition-all duration-300",
          searchFocused && "scale-105"
        )}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search games..."
            className={cn(
              "pl-11 pr-4 h-11 bg-secondary/50 border-0 rounded-xl transition-all",
              searchFocused && "bg-secondary ring-2 ring-primary/20"
            )}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Online Users Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg glass-light">
          <div className="w-2 h-2 bg-green-500 rounded-full live-pulse" />
          <span className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{onlineUsers.toLocaleString()}</span> online
          </span>
        </div>

        {/* Sound Toggle */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground rounded-xl"
          onClick={() => setSoundEnabled(!soundEnabled)}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>

        {/* Chat */}
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-xl">
          <MessageCircle className="w-5 h-5" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground rounded-xl">
          <Bell className="w-5 h-5" />
          {notifications > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
              {notifications}
            </span>
          )}
        </Button>

        {isAuthenticated && user ? (
          <>
            {/* Wallet */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="h-11 border-primary/20 bg-primary/5 hover:bg-primary/10 gap-2 rounded-xl px-4"
                >
                  <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="font-mono font-bold text-primary">
                    ${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 glass border-border rounded-xl p-0 overflow-hidden">
                <div className="p-4 bg-gradient-to-br from-primary/10 to-transparent">
                  <div className="text-xs text-muted-foreground mb-1">Total Balance</div>
                  <div className="text-3xl font-bold text-primary font-mono">
                    ${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-2">
                  <DropdownMenuItem className="gap-3 py-3 cursor-pointer rounded-lg hover:bg-primary/10">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <div className="font-medium">Deposit</div>
                      <div className="text-xs text-muted-foreground">Add funds to your account</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-3 py-3 cursor-pointer rounded-lg hover:bg-primary/10">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium">Withdraw</div>
                      <div className="text-xs text-muted-foreground">Cash out your winnings</div>
                    </div>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2 rounded-xl h-11">
                  <div className="relative">
                    <Avatar className="w-9 h-9 ring-2 ring-primary/20">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-[#00a07a] text-primary-foreground text-sm font-bold">
                        {user.username?.slice(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    {user.isAdmin && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-accent rounded-full flex items-center justify-center">
                        <span className="text-[8px] text-accent-foreground font-bold">A</span>
                      </div>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass border-border rounded-xl">
                <DropdownMenuLabel className="pb-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{user.username}</span>
                    {user.vipLevel && (
                      <Badge variant="outline" className={cn("text-[10px] uppercase", getVipColor(user.vipLevel))}>
                        {user.vipLevel}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-normal mt-0.5">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer gap-2">
                  <User className="w-4 h-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2">
                  <History className="w-4 h-4" />
                  Transaction History
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  onClick={logout}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            <Button 
              variant="ghost" 
              className="h-11 rounded-xl font-medium"
              onClick={onSignIn}
            >
              Sign In
            </Button>
            <Button 
              className="h-11 rounded-xl font-semibold"
              onClick={onSignIn}
            >
              Sign Up
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
