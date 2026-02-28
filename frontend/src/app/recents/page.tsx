'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GameLayout } from '@/components/GameLayout'
import { Clock, Play, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

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

const GAME_META: Record<string, { icon: string; href: string }> = {
  crash: { icon: '🚀', href: '/games/crash' },
  dice: { icon: '🎲', href: '/games/dice' },
  mines: { icon: '💣', href: '/games/mines' },
  plinko: { icon: '🔮', href: '/games/plinko' },
  limbo: { icon: '🎯', href: '/games/limbo' },
  wheel: { icon: '🎡', href: '/games/wheel' },
  keno: { icon: '⭐', href: '/games/keno' },
  twentyone: { icon: '🃏', href: '/games/twentyone' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function RecentsPage() {
  const { token, isAuthenticated, isHydrated } = useAuthStore()
  const [bets, setBets] = useState<BetRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated || !token) { setLoading(false); return }
    fetch('/api/v1/bets/history?page=1&per_page=20', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.bets) setBets(d.bets) })
      .finally(() => setLoading(false))
  }, [isHydrated, isAuthenticated, token])

  const totalBet = bets.reduce((s, b) => s + parseFloat(b.bet_amount || '0'), 0)
  const totalWins = bets.filter(b => parseFloat(b.profit || '0') > 0).reduce((s, b) => s + parseFloat(b.payout || '0'), 0)
  const profit = totalWins - totalBet

  return (
    <GameLayout>
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary">Recent Games</h1>
                <p className="text-text-muted text-sm">Your history</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">Session</p>
              <p className={`font-bold font-mono ${profit >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-surface/50 rounded-lg border border-border/60 p-3">
              <p className="text-xs text-text-muted mb-1">Wagered</p>
              <p className="font-bold text-text-primary font-mono">{formatCurrency(totalBet)}</p>
            </div>
            <div className="bg-surface/50 rounded-lg border border-border/60 p-3">
              <p className="text-xs text-text-muted mb-1">Wins</p>
              <p className="font-bold text-accent-green font-mono">{formatCurrency(totalWins)}</p>
            </div>
            <div className="bg-surface/50 rounded-lg border border-border/60 p-3">
              <p className="text-xs text-text-muted mb-1">Games</p>
              <p className="font-bold text-text-primary">{bets.length}</p>
            </div>
          </div>

          {/* Games List */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-brand animate-spin" />
            </div>
          ) : bets.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-text-primary mb-2">No recent games</h2>
              <p className="text-text-muted text-sm mb-4">{isAuthenticated ? 'Play some games to see your history here' : 'Sign in to track your bet history'}</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand rounded-lg text-background text-sm font-medium"
              >
                <Play className="w-4 h-4" /> Browse Games
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {bets.map((bet) => {
                const profitVal = parseFloat(bet.profit || '0')
                const isWin = profitVal >= 0
                const meta = GAME_META[bet.game_type] || { icon: '🎮', href: '/' }
                return (
                  <Link
                    key={bet.bet_id}
                    href={meta.href}
                    className="flex items-center gap-3 bg-surface/50 rounded-lg border border-border/60 p-3 hover:border-border-light transition-colors"
                  >
                    <div className="w-10 h-10 bg-surface-light rounded-lg flex items-center justify-center text-xl">
                      {meta.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary capitalize">{bet.game_type}</span>
                        {isWin ? (
                          <TrendingUp className="w-3.5 h-3.5 text-accent-green" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-accent-red" />
                        )}
                      </div>
                      <p className="text-xs text-text-muted">{bet.timestamp ? timeAgo(bet.timestamp) : ''}</p>
                    </div>

                    <div className="text-right">
                      <p className={`text-sm font-mono ${isWin ? 'text-accent-green' : 'text-accent-red'}`}>
                        {isWin ? '+' : ''}{formatCurrency(profitVal)}
                      </p>
                      <p className="text-xs text-brand font-mono">{parseFloat(bet.multiplier).toFixed(2)}x</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </GameLayout>
  )
}
