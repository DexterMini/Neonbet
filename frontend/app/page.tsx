"use client"

import { useEffect, useState } from "react"
import { CasinoSidebar } from "@/components/casino/sidebar"
import { CasinoHeader } from "@/components/casino/header"
import { GameGrid } from "@/components/casino/game-grid"
import { AdminPanel } from "@/components/casino/admin-panel"
import { AuthModal } from "@/components/casino/auth-modal"
import { useCasinoStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export default function CasinoPage() {
  const { 
    currentView, 
    sidebarCollapsed, 
    user,
    isAuthenticated,
    fetchMe,
    updateOnlineUsers,
  } = useCasinoStore()
  
  const [mounted, setMounted] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  // Restore session from saved token on mount
  useEffect(() => {
    setMounted(true)
    fetchMe()
  }, [fetchMe])

  // Ambient online users drift
  useEffect(() => {
    const drift = () => {
      const base = 4283
      const hour = new Date().getHours()
      // Higher during evening hours (18-02), lower during day
      const timeMultiplier = (hour >= 18 || hour < 2) ? 1.4 : (hour >= 10 && hour < 18) ? 1.0 : 0.7
      const variance = Math.floor((Math.random() - 0.5) * 120)
      updateOnlineUsers(Math.floor(base * timeMultiplier) + variance)
    }
    drift()
    const interval = setInterval(drift, 15000)
    return () => clearInterval(interval)
  }, [updateOnlineUsers])

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
          </div>
          <span className="text-sm text-muted-foreground">Loading Celora...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background cyber-grid">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#00d4ff]/5 rounded-full blur-[150px]" />
      </div>

      <CasinoSidebar />
      
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 relative",
        sidebarCollapsed ? "ml-[72px]" : "ml-[260px]"
      )}>
        <CasinoHeader onSignIn={() => setAuthOpen(true)} />
        
        <main className="flex-1 overflow-auto p-6">
          {currentView === "lobby" && <GameGrid />}
          {currentView === "admin" && user?.isAdmin === true && <AdminPanel />}
          {currentView === "admin" && !user?.isAdmin && <GameGrid />}
        </main>
      </div>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  )
}
