"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, TrendingUp, Flame, Star, Sparkles, Play, Zap, Trophy, ChevronRight, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { CELORA_GAMES, type Game } from "@/lib/store"
import * as api from "@/lib/api"

// Consistent number formatting to avoid hydration mismatch
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

const categories = [
  { id: "all", label: "All Games", icon: Sparkles },
  { id: "originals", label: "Celora Originals", icon: Zap },
  { id: "slots", label: "Slots", icon: Star },
  { id: "live", label: "Live Casino", icon: Users },
  { id: "table", label: "Table Games", icon: Trophy },
]

export function GameGrid() {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [livePlayers, setLivePlayers] = useState<Record<string, number>>({})
  const [featuredMultiplier, setFeaturedMultiplier] = useState(156.42)
  
  // Fetch real game stats from API
  useEffect(() => {
    let cancelled = false
    const fetchGameStats = async () => {
      try {
        const stats = await api.getAdminStatsGames()
        if (cancelled) return
        const players: Record<string, number> = {}
        if (Array.isArray(stats)) {
          stats.forEach((s: any) => {
            players[s.game_type || s.id] = s.active_players || s.bets_24h || 0
          })
        }
        setLivePlayers(players)
      } catch {
        // Not admin or API down — show 0 players
      }
    }
    
    fetchGameStats()
    const interval = setInterval(fetchGameStats, 30000) // refresh every 30s
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Simulate featured multiplier
  useEffect(() => {
    const interval = setInterval(() => {
      setFeaturedMultiplier(prev => {
        const change = (Math.random() - 0.5) * 10
        return Math.max(1, prev + change)
      })
    }, 100)
    return () => clearInterval(interval)
  }, [])
  
  const filteredGames = selectedCategory === "all" 
    ? CELORA_GAMES 
    : CELORA_GAMES.filter(g => g.category === selectedCategory)

  return (
    <div className="space-y-8">
      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
              selectedCategory === cat.id
                ? "bg-primary text-primary-foreground neon-glow"
                : "glass-light text-muted-foreground hover:text-foreground"
            )}
          >
            <cat.icon className="w-4 h-4" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Featured Banner - Crash Game */}
      <div className="relative overflow-hidden rounded-2xl glass neon-border">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/50 via-transparent to-cyan-950/50" />
          <svg className="absolute inset-0 w-full h-full opacity-20">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary/30" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative flex items-center justify-between p-8">
          <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-accent/20 text-accent border-accent/30 uppercase text-xs font-bold tracking-wider px-3 py-1">
                Featured
              </Badge>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 live-pulse inline-block" />
                {formatNumber(livePlayers['crash'] || 0)} playing
              </Badge>
            </div>
            <h2 className="text-4xl font-bold mb-3 tracking-tight">Crash</h2>
            <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
              Watch the multiplier rise and cash out before it crashes. 
              Can you time it perfectly?
            </p>
            <div className="flex items-center gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 rounded-xl h-12 neon-glow">
                <Play className="w-5 h-5 mr-2" />
                Play Now
              </Button>
              <Button size="lg" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 rounded-xl h-12">
                <Info className="w-5 h-5 mr-2" />
                How to Play
              </Button>
            </div>
          </div>

          {/* Live Multiplier Display */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Graph Visualization */}
              <div className="relative w-80 h-48">
                <svg className="w-full h-full" viewBox="0 0 320 192">
                  {/* Grid lines */}
                  {[0, 48, 96, 144, 192].map((y) => (
                    <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="rgba(255,255,255,0.05)" />
                  ))}
                  
                  {/* Curve */}
                  <path
                    d="M0 180 Q 80 160 160 100 Q 240 40 300 20"
                    fill="none"
                    stroke="url(#curveGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  
                  {/* Gradient definition */}
                  <defs>
                    <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00ff9d" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#00ff9d" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  
                  {/* Glow point */}
                  <circle cx="300" cy="20" r="8" fill="#00ff9d" className="live-pulse">
                    <animate attributeName="r" values="6;10;6" dur="1s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="300" cy="20" r="4" fill="#ffffff" />
                </svg>

                {/* Multiplier Badge */}
                <div className="absolute top-2 right-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 backdrop-blur-sm border border-primary/30">
                  <span className="text-4xl font-bold font-mono text-primary neon-text">
                    {featuredMultiplier.toFixed(2)}x
                  </span>
                </div>
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-between mt-4 px-4 py-3 rounded-xl glass-light">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Last Crash</div>
                  <div className="text-lg font-bold text-destructive font-mono">1.24x</div>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Max Win</div>
                  <div className="text-lg font-bold text-primary font-mono">1,000x</div>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">RTP</div>
                  <div className="text-lg font-bold text-foreground font-mono">97%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold">Celora Originals</h3>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
            {filteredGames.length} games
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary gap-1">
          View All
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {filteredGames.map((game) => (
          <GameCard 
            key={game.id} 
            game={game} 
            players={livePlayers[game.id] || 0}
          />
        ))}
      </div>
    </div>
  )
}

interface GameCardProps {
  game: Game
  players: number
}

function GameCard({ game, players }: GameCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div 
      className="group game-card rounded-2xl overflow-hidden cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Game Preview */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <GameVisual game={game} isHovered={isHovered} />
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge className="bg-primary/90 text-primary-foreground text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider backdrop-blur-sm">
            Celora
          </Badge>
          {game.isNew && (
            <Badge className="bg-[#00d4ff]/90 text-white text-[10px] px-2 py-0.5 font-bold backdrop-blur-sm">
              NEW
            </Badge>
          )}
          {game.isHot && (
            <Badge className="bg-orange-500/90 text-white text-[10px] px-2 py-0.5 font-bold backdrop-blur-sm">
              <Flame className="w-3 h-3 mr-0.5" />
              HOT
            </Badge>
          )}
        </div>

        {/* Max Multiplier */}
        {game.maxWin > 10000 && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
            <span className="text-primary text-xs font-bold font-mono">
              {formatNumber(game.maxWin / game.minBet)}x
            </span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col items-center justify-end pb-6 transition-all duration-300",
          isHovered ? "opacity-100" : "opacity-0"
        )}>
          <Button 
            size="sm" 
            className={cn(
              "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 rounded-xl transition-all duration-300",
              isHovered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}
          >
            <Play className="w-4 h-4 mr-2" />
            Play
          </Button>
        </div>
      </div>

      {/* Game Info */}
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-sm truncate">{game.name}</h3>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-pulse" />
            {formatNumber(players)} playing
          </span>
          <span className="flex items-center gap-1 text-primary">
            <TrendingUp className="w-3 h-3" />
            {game.rtp}%
          </span>
        </div>
      </div>
    </div>
  )
}

interface GameVisualProps {
  game: Game
  isHovered: boolean
}

function GameVisual({ game, isHovered }: GameVisualProps) {
  const visuals: Record<string, JSX.Element> = {
    crash: (
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="relative">
          <svg className="w-32 h-24" viewBox="0 0 128 96">
            <path
              d="M10 85 Q 40 60 70 40 Q 100 20 118 8"
              fill="none"
              stroke="#00ff9d"
              strokeWidth="3"
              strokeLinecap="round"
              className={cn(isHovered && "animate-pulse")}
            />
            <circle cx="118" cy="8" r="6" fill="#00ff9d" />
            <circle cx="118" cy="8" r="3" fill="#ffffff" />
          </svg>
          <div className="absolute -top-2 right-0 text-2xl font-bold text-primary font-mono neon-text">
            2.4x
          </div>
        </div>
      </div>
    ),
    mines: (
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950 via-teal-900 to-emerald-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="grid grid-cols-3 gap-2 p-4">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all duration-300",
                [0, 2, 4, 6, 8].includes(i) 
                  ? "bg-primary/20 border border-primary/40 shadow-[0_0_10px_rgba(0,255,157,0.3)]" 
                  : "bg-white/5 border border-white/10",
                isHovered && [0, 2, 4, 6, 8].includes(i) && "scale-110"
              )}
            >
              {[0, 2, 4, 6, 8].includes(i) && (
                <Sparkles className="w-4 h-4 text-primary" />
              )}
            </div>
          ))}
        </div>
      </div>
    ),
    dice: (
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-indigo-900 to-violet-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className={cn(
          "flex gap-4 transition-transform duration-500",
          isHovered && "rotate-12 scale-110"
        )}>
          <div className="w-16 h-16 rounded-xl bg-white/90 shadow-xl flex items-center justify-center transform rotate-6">
            <div className="grid grid-cols-2 gap-1.5 p-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-900"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-900"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-900"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-900"></div>
            </div>
          </div>
          <div className="w-16 h-16 rounded-xl bg-cyan-300 shadow-xl flex items-center justify-center transform -rotate-12">
            <div className="w-3 h-3 rounded-full bg-indigo-900"></div>
          </div>
        </div>
      </div>
    ),
    plinko: (
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-orange-900 to-red-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="relative">
          <div className="flex flex-col items-center gap-3">
            {[3, 4, 5, 6].map((dots, row) => (
              <div key={row} className="flex gap-4">
                {[...Array(dots)].map((_, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full bg-amber-400/60"></div>
                ))}
              </div>
            ))}
          </div>
          <div className={cn(
            "absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-accent shadow-[0_0_20px_rgba(240,180,41,0.6)]",
            isHovered ? "animate-bounce" : ""
          )} />
        </div>
      </div>
    ),
    limbo: (
      <div className="absolute inset-0 bg-gradient-to-br from-pink-950 via-rose-900 to-red-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="text-center">
          <div className={cn(
            "text-5xl font-bold font-mono text-white/20 transition-all duration-300",
            isHovered && "text-white/40 scale-110"
          )}>
            1M
          </div>
          <div className="mt-3 px-4 py-1.5 bg-white/10 rounded-full text-xs text-white/60 border border-white/20">
            TARGET
          </div>
        </div>
      </div>
    ),
    wheel: (
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-violet-900 to-indigo-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className={cn(
          "relative w-24 h-24 transition-transform duration-1000",
          isHovered && "rotate-180"
        )}>
          <div className="absolute inset-0 rounded-full border-4 border-dashed border-white/30"></div>
          <div className="absolute inset-2 rounded-full" style={{
            background: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)'
          }}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-white shadow-lg"></div>
          </div>
        </div>
      </div>
    ),
    keno: (
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-blue-900 to-cyan-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="grid grid-cols-5 gap-1.5 p-3">
          {[...Array(25)].map((_, i) => {
            const selected = [2, 7, 11, 13, 18, 22].includes(i)
            return (
              <div
                key={i}
                className={cn(
                  "w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold transition-all",
                  selected 
                    ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,255,157,0.4)]" 
                    : "bg-white/10 text-white/40"
                )}
              >
                {i + 1}
              </div>
            )
          })}
        </div>
      </div>
    ),
    blackjack: (
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-green-900 to-teal-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className={cn(
          "flex -space-x-8 transition-transform duration-300",
          isHovered && "-rotate-6 scale-110"
        )}>
          <div className="w-14 h-20 rounded-xl bg-white shadow-xl flex flex-col items-center justify-center transform rotate-6 border-2 border-white/50">
            <span className="text-red-500 text-sm">&#9829;</span>
            <span className="text-xl font-bold text-gray-900">A</span>
          </div>
          <div className="w-14 h-20 rounded-xl bg-white shadow-xl flex flex-col items-center justify-center transform -rotate-3 border-2 border-white/50">
            <span className="text-gray-900 text-sm">&#9824;</span>
            <span className="text-xl font-bold text-gray-900">K</span>
          </div>
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary/90 rounded-lg">
          <span className="text-primary-foreground text-sm font-bold">21</span>
        </div>
      </div>
    ),
    'coin-climber': (
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-950 via-amber-900 to-orange-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="flex flex-col items-center gap-1">
          {[4, 3, 2, 1].map((level) => (
            <div key={level} className="flex gap-2">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-6 h-6 rounded-lg border transition-all",
                    level === 4 && i === 1 
                      ? "bg-accent border-accent/60 shadow-[0_0_15px_rgba(240,180,41,0.5)]" 
                      : "bg-white/5 border-white/10"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="absolute top-3 right-3 px-2 py-1 bg-primary/90 rounded-lg">
          <span className="text-primary-foreground text-xs font-bold">782x</span>
        </div>
      </div>
    ),
    snake: (
      <div className="absolute inset-0 bg-gradient-to-br from-green-950 via-emerald-900 to-teal-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <svg className="w-24 h-24" viewBox="0 0 96 96">
          <path
            d="M20 80 C 20 60 40 60 40 40 C 40 20 60 20 76 20"
            fill="none"
            stroke="#00ff9d"
            strokeWidth="8"
            strokeLinecap="round"
            className={cn(isHovered && "animate-pulse")}
          />
          <circle cx="76" cy="20" r="6" fill="#00ff9d" />
          <circle cx="74" cy="18" r="2" fill="#0a0a0a" />
          <circle cx="78" cy="18" r="2" fill="#0a0a0a" />
          <circle cx="30" cy="50" r="4" fill="#ef4444" />
        </svg>
      </div>
    ),
    chicken: (
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-950 via-amber-900 to-orange-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="flex gap-2 items-end">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "rounded-full transition-all",
                i < 3 
                  ? "w-6 h-6 bg-primary/30 border border-primary/50" 
                  : "w-6 h-6 bg-white/10 border border-white/20"
              )}
            >
              {i < 3 && (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="absolute top-3 right-3 px-2 py-1 bg-accent/90 rounded-lg">
          <span className="text-accent-foreground text-xs font-bold">50/50</span>
        </div>
      </div>
    ),
    'coin-flip': (
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-yellow-900 to-orange-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className={cn(
          "relative transition-transform duration-500",
          isHovered && "rotate-y-180 scale-110"
        )}>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-xl flex items-center justify-center border-4 border-amber-300">
            <span className="text-3xl font-bold text-amber-900">$</span>
          </div>
        </div>
        <div className="absolute top-3 right-3 px-2 py-1 bg-primary/90 rounded-lg">
          <span className="text-primary-foreground text-xs font-bold">1.98x</span>
        </div>
      </div>
    ),
  }

  return visuals[game.slug] || visuals[game.id] || (
    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
      <div className="absolute inset-0 cyber-grid opacity-30" />
      <Sparkles className="w-16 h-16 text-white/10" />
    </div>
  )
}
