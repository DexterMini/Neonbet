"use client"

import { useEffect, useState } from "react"
import { CasinoSidebar } from "@/components/casino/sidebar"
import { CasinoHeader } from "@/components/casino/header"
import { GameGrid } from "@/components/casino/game-grid"
import { AdminPanel } from "@/components/casino/admin-panel"
import { useCasinoStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export default function CasinoPage() {
  const { 
    currentView, 
    sidebarCollapsed, 
    user,
    setUser,
    updateOnlineUsers 
  } = useCasinoStore()
  
  const [mounted, setMounted] = useState(false)

  // Simulate live data updates
  useEffect(() => {
    setMounted(true)
    
    // Auto-login as admin for demo (remove in production)
    if (!user) {
      setUser({
        id: 'admin-1',
        username: 'Admin',
        email: 'admin@celora.net',
        vipLevel: 'svip',
        balance: 0,
        currency: 'USD',
        isAdmin: true,
        createdAt: new Date(),
        totalWagered: 0,
        totalWon: 0,
      })
    }

    // Simulate online users updates
    const interval = setInterval(() => {
      updateOnlineUsers(Math.floor(Math.random() * 500) + 800)
    }, 5000)

    return () => clearInterval(interval)
  }, [user, setUser, updateOnlineUsers])

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
        <CasinoHeader />
        
        <main className="flex-1 overflow-auto p-6">
          {currentView === "lobby" && <GameGrid />}
          {currentView === "admin" && user?.isAdmin && <AdminPanel />}
        </main>
      </div>
    </div>
  )
}
