'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GameLayout } from '@/components/GameLayout'
import { Star, Heart, Play, Trash2, TrendingUp, Dices, Bomb, CircleDot, Target, RotateCcw, Grid3X3, Spade, type LucideIcon } from 'lucide-react'

interface Favourite {
  id: string
  name: string
  icon: LucideIcon
  iconColor: string
  href: string
  mult: string
}

const ALL_GAMES: Favourite[] = [
  { id: 'crash', name: 'Crash', icon: TrendingUp, iconColor: 'text-brand', href: '/games/crash', mult: '∞' },
  { id: 'dice', name: 'Dice', icon: Dices, iconColor: 'text-violet-400', href: '/games/dice', mult: '99x' },
  { id: 'mines', name: 'Mines', icon: Bomb, iconColor: 'text-cyan-400', href: '/games/mines', mult: '24x' },
  { id: 'plinko', name: 'Plinko', icon: CircleDot, iconColor: 'text-orange-400', href: '/games/plinko', mult: '1000x' },
  { id: 'limbo', name: 'Limbo', icon: Target, iconColor: 'text-rose-400', href: '/games/limbo', mult: '100x' },
  { id: 'wheel', name: 'Wheel', icon: RotateCcw, iconColor: 'text-amber-400', href: '/games/wheel', mult: '50x' },
  { id: 'keno', name: 'Keno', icon: Grid3X3, iconColor: 'text-emerald-400', href: '/games/keno', mult: '3500x' },
  { id: 'twentyone', name: 'Blackjack', icon: Spade, iconColor: 'text-red-400', href: '/games/twentyone', mult: '2.5x' },
]

const STORAGE_KEY = 'neonbet_favourites'

function loadFavourites(): Favourite[] {
  if (typeof window === 'undefined') return []
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return ALL_GAMES.filter(g => ids.includes(g.id))
  } catch { return [] }
}

function saveFavourites(favs: Favourite[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs.map(f => f.id)))
}

export default function FavouritesPage() {
  const [favourites, setFavourites] = useState<Favourite[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const saved = loadFavourites()
    setFavourites(saved.length > 0 ? saved : ALL_GAMES.slice(0, 3))
    setLoaded(true)
  }, [])

  const removeFavourite = (id: string) => {
    setFavourites(prev => {
      const next = prev.filter(f => f.id !== id)
      saveFavourites(next)
      return next
    })
  }

  const addFavourite = (game: Favourite) => {
    setFavourites(prev => {
      if (prev.some(f => f.id === game.id)) return prev
      const next = [...prev, game]
      saveFavourites(next)
      return next
    })
  }

  const availableToAdd = ALL_GAMES.filter(g => !favourites.some(f => f.id === g.id))

  return (
    <GameLayout>
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-text-primary fill-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Favourites</h1>
              <p className="text-text-muted text-sm">Your saved games</p>
            </div>
          </div>

          {favourites.length === 0 ? (
            <div className="text-center py-16">
              <Heart className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-text-primary mb-2">No favourites yet</h2>
              <p className="text-text-muted text-sm mb-4">Add games to your favourites to find them here</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500 rounded-lg text-text-primary text-sm font-medium"
              >
                <Play className="w-4 h-4" /> Browse Games
              </Link>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {favourites.map((game) => (
                <div key={game.id} className="group relative bg-surface/50 rounded-xl border border-border/60 p-4">
                  <button
                    onClick={() => removeFavourite(game.id)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-text-muted hover:text-accent-red hover:bg-accent-red/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  <Link href={game.href}>
                    <div className="w-10 h-10 rounded-xl bg-surface-light flex items-center justify-center mb-3">
                      <game.icon className={`w-5 h-5 ${game.iconColor}`} />
                    </div>
                    <h3 className="font-semibold text-text-primary mb-1">{game.name}</h3>
                    <p className="text-sm text-brand font-mono">{game.mult} max</p>
                  </Link>
                </div>
              ))}
            </div>

            {/* Add more */}
            {availableToAdd.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold text-text-muted mb-3">Add to Favourites</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {availableToAdd.map(game => (
                    <button
                      key={game.id}
                      onClick={() => addFavourite(game)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border/60 hover:border-brand/40 hover:bg-surface/30 transition-colors"
                    >
                      <game.icon className={`w-5 h-5 ${game.iconColor}`} />
                      <span className="text-text-muted text-sm">{game.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>
    </GameLayout>
  )
}
