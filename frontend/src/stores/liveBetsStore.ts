import { create } from 'zustand'

/* ── Types ───────────────────────────────────────── */
export interface LiveBet {
  id: string
  username: string
  avatar: string
  game: string
  betAmount: number
  multiplier: number
  profit: number
  currency: string
  timestamp: number
}

interface LiveBetsState {
  bets: LiveBet[]
  myBets: LiveBet[]
  isGenerating: boolean
  addBet: (bet: LiveBet) => void
  addMyBet: (bet: LiveBet) => void
  startGenerating: (game: string) => void
  stopGenerating: () => void
}

/* ── Fake data ───────────────────────────────────── */
const USERNAMES = [
  'xShadow', 'Ace_High', 'neon_rider', 'CRYPTx', 'lucky777',
  'zK_maxi', 'blitz99', 'whale.sol', 'DarkPool', 'hash_rate',
  'Phantom42', 'rollup_', 'StackEmUp', 'degen.eth', 'MidnightBet',
  'v0rtex', 'ironclad', 'flip_king', 'raw_alpha', 'OG_staker',
  'coinflip_', 'RiskIt', 'astro_bet', 'ZeroChill', 'wager_boi',
  'grindmode', 'BetNCry', 'moon_dust', 'sharkfin', 'high_vol',
]

const AVATARS = ['🦊', '🐋', '💎', '🚀', '🔥', '👑', '🎯', '⚡', '🌙', '🎲',
  '🃏', '🐍', '🦁', '🐺', '🦅', '🗿', '🤖', '🎭', '👻', '💀']

// Realistic bet tiers — most players bet small, few bet big
const BET_TIERS = [
  { min: 0.50,  max: 5,     weight: 25 },  // micro
  { min: 5,     max: 25,    weight: 30 },  // small
  { min: 25,    max: 100,   weight: 22 },  // medium
  { min: 100,   max: 500,   weight: 15 },  // large
  { min: 500,   max: 2500,  weight: 6 },   // high roller
  { min: 2500,  max: 10000, weight: 2 },   // whale
]

function pickBetAmount(): number {
  const totalWeight = BET_TIERS.reduce((s, t) => s + t.weight, 0)
  let r = Math.random() * totalWeight
  for (const tier of BET_TIERS) {
    r -= tier.weight
    if (r <= 0) {
      // Use non-uniform distribution within tier for realism
      const v = tier.min + Math.pow(Math.random(), 1.5) * (tier.max - tier.min)
      // Round to realistic amounts
      if (v < 10) return parseFloat(v.toFixed(2))
      if (v < 100) return parseFloat((Math.round(v * 4) / 4).toFixed(2)) // nearest 0.25
      return parseFloat(Math.round(v).toFixed(2)) // whole dollars
    }
  }
  return 10
}

// Game-specific multiplier distributions
function pickMultiplier(game: string, isWin: boolean): number {
  if (!isWin) return 0
  const r = Math.random()
  switch (game) {
    case 'crash':
      // Most cash out early, rare big multipliers
      if (r < 0.40) return parseFloat((1.1 + Math.random() * 0.9).toFixed(2))
      if (r < 0.70) return parseFloat((2 + Math.random() * 3).toFixed(2))
      if (r < 0.90) return parseFloat((5 + Math.random() * 10).toFixed(2))
      return parseFloat((15 + Math.random() * 85).toFixed(2))
    case 'dice':
    case 'limbo':
      if (r < 0.50) return parseFloat((1.1 + Math.random() * 0.9).toFixed(2))
      if (r < 0.80) return parseFloat((2 + Math.random() * 4).toFixed(2))
      return parseFloat((6 + Math.random() * 20).toFixed(2))
    case 'mines':
    case 'coinclimber':
    case 'chicken':
      if (r < 0.45) return parseFloat((1.2 + Math.random() * 1.8).toFixed(2))
      if (r < 0.75) return parseFloat((3 + Math.random() * 5).toFixed(2))
      return parseFloat((8 + Math.random() * 30).toFixed(2))
    case 'plinko':
    case 'wheel':
    case 'keno':
      if (r < 0.55) return parseFloat((1.1 + Math.random() * 1.4).toFixed(2))
      if (r < 0.85) return parseFloat((2.5 + Math.random() * 5).toFixed(2))
      return parseFloat((7 + Math.random() * 40).toFixed(2))
    default:
      return parseFloat((1 + Math.random() * 5).toFixed(2))
  }
}

// Keep a small pool of "active" players per session for realistic repeat appearances
let activePlayerPool: { username: string; avatar: string }[] = []
function getPlayer() {
  if (activePlayerPool.length === 0 || Math.random() < 0.15) {
    // Add a new player to the pool (or refresh)
    const newPlayer = {
      username: USERNAMES[Math.floor(Math.random() * USERNAMES.length)],
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    }
    activePlayerPool.push(newPlayer)
    if (activePlayerPool.length > 12) activePlayerPool.shift()
    return newPlayer
  }
  // 85%  of the time, pick from existing pool (players appear multiple times like real casino)
  return activePlayerPool[Math.floor(Math.random() * activePlayerPool.length)]
}

let intervalId: NodeJS.Timeout | null = null

/* ── Store ───────────────────────────────────────── */
export const useLiveBetsStore = create<LiveBetsState>((set, get) => ({
  bets: [],
  myBets: [],
  isGenerating: false,

  addBet: (bet) => set(s => ({ bets: [bet, ...s.bets].slice(0, 30) })),
  addMyBet: (bet) => set(s => ({
    bets: [bet, ...s.bets].slice(0, 30),
    myBets: [bet, ...s.myBets].slice(0, 50),
  })),

  startGenerating: (game: string) => {
    if (intervalId) clearInterval(intervalId)
    set({ isGenerating: true })

    // Generate initial batch (stagger timestamps so they look historical)
    const now = Date.now()
    const initialBets: LiveBet[] = Array.from({ length: 10 }, (_, i) => ({
      ...generateFakeBet(game),
      timestamp: now - (10 - i) * (2000 + Math.random() * 4000),
    }))
    set({ bets: initialBets })

    // Generate new bets at irregular intervals (real casinos aren't clockwork)
    const scheduleNext = () => {
      const delay = 800 + Math.random() * 3500 // 0.8s – 4.3s
      intervalId = setTimeout(() => {
        const bet = generateFakeBet(game)
        get().addBet(bet)
        if (get().isGenerating) scheduleNext()
      }, delay) as unknown as ReturnType<typeof setInterval>
    }
    scheduleNext()
  },

  stopGenerating: () => {
    if (intervalId) {
      clearTimeout(intervalId as unknown as number)
      intervalId = null
    }
    set({ isGenerating: false })
  },
}))

function generateFakeBet(game: string): LiveBet {
  const isWin = Math.random() > 0.52 // ~48% win rate (house edge)
  const betAmount = pickBetAmount()
  const multiplier = pickMultiplier(game, isWin)
  const player = getPlayer()

  return {
    id: Math.random().toString(36).slice(2, 10),
    username: player.username,
    avatar: player.avatar,
    game,
    betAmount,
    multiplier,
    profit: isWin ? parseFloat((betAmount * multiplier - betAmount).toFixed(2)) : -betAmount,
    currency: 'USD',
    timestamp: Date.now(),
  }
}
