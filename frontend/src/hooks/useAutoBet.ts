'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

/* ── Types ───────────────────────────────────────── */
export interface AutoBetConfig {
  enabled: boolean
  numberOfBets: number      // 0 = infinite
  onWin: 'reset' | 'increase'
  onWinPercent: number      // e.g. 50 = increase 50%
  onLoss: 'reset' | 'increase'
  onLossPercent: number
  stopOnProfit: number      // 0 = disabled
  stopOnLoss: number        // 0 = disabled
}

export const defaultAutoBetConfig: AutoBetConfig = {
  enabled: false,
  numberOfBets: 0,
  onWin: 'reset',
  onWinPercent: 0,
  onLoss: 'reset',
  onLossPercent: 0,
  stopOnProfit: 0,
  stopOnLoss: 0,
}

export interface AutoBetState {
  running: boolean
  baseBet: number
  currentBet: number
  betsPlaced: number
  totalWagered: number
  totalProfit: number
  wins: number
  losses: number
  currentStreak: number   // positive = win streak, negative = loss streak
  bestStreak: number
}

const defaultState: AutoBetState = {
  running: false,
  baseBet: 0,
  currentBet: 0,
  betsPlaced: 0,
  totalWagered: 0,
  totalProfit: 0,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  bestStreak: 0,
}

/* ── Hook ────────────────────────────────────────── */
export function useAutoBet(
  config: AutoBetConfig,
  betAmount: string,
  onBet: (amount: number) => Promise<{ won: boolean; profit: number }>,
) {
  const [state, setState] = useState<AutoBetState>(defaultState)
  const stateRef = useRef(state)
  const configRef = useRef(config)
  const runningRef = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  stateRef.current = state
  configRef.current = config

  const stop = useCallback(() => {
    runningRef.current = false
    if (intervalRef.current) {
      clearTimeout(intervalRef.current)
      intervalRef.current = null
    }
    setState(prev => ({ ...prev, running: false }))
  }, [])

  const start = useCallback(async () => {
    const base = parseFloat(betAmount)
    if (isNaN(base) || base <= 0) return

    const initialState: AutoBetState = {
      running: true,
      baseBet: base,
      currentBet: base,
      betsPlaced: 0,
      totalWagered: 0,
      totalProfit: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
    }
    setState(initialState)
    stateRef.current = initialState
    runningRef.current = true

    const runNext = async () => {
      if (!runningRef.current) return

      const s = stateRef.current
      const c = configRef.current

      // Check number of bets limit
      if (c.numberOfBets > 0 && s.betsPlaced >= c.numberOfBets) {
        stop()
        return
      }

      try {
        const result = await onBet(s.currentBet)
        const newProfit = s.totalProfit + result.profit
        let newBet = s.currentBet
        const newStreak = result.won
          ? (s.currentStreak >= 0 ? s.currentStreak + 1 : 1)
          : (s.currentStreak <= 0 ? s.currentStreak - 1 : -1)

        // Adjust bet on outcome
        if (result.won) {
          if (c.onWin === 'increase' && c.onWinPercent > 0) {
            newBet = s.currentBet * (1 + c.onWinPercent / 100)
          } else {
            newBet = s.baseBet
          }
        } else {
          if (c.onLoss === 'increase' && c.onLossPercent > 0) {
            newBet = s.currentBet * (1 + c.onLossPercent / 100)
          } else {
            newBet = s.baseBet
          }
        }

        newBet = parseFloat(newBet.toFixed(2))

        const newState: AutoBetState = {
          running: true,
          baseBet: s.baseBet,
          currentBet: newBet,
          betsPlaced: s.betsPlaced + 1,
          totalWagered: s.totalWagered + s.currentBet,
          totalProfit: newProfit,
          wins: s.wins + (result.won ? 1 : 0),
          losses: s.losses + (result.won ? 0 : 1),
          currentStreak: newStreak,
          bestStreak: Math.max(s.bestStreak, Math.abs(newStreak)),
        }
        setState(newState)
        stateRef.current = newState

        // Check stop conditions
        if (c.stopOnProfit > 0 && newProfit >= c.stopOnProfit) {
          stop()
          return
        }
        if (c.stopOnLoss > 0 && Math.abs(newProfit) >= c.stopOnLoss && newProfit < 0) {
          stop()
          return
        }

        // Schedule next bet
        if (runningRef.current) {
          intervalRef.current = setTimeout(runNext, 800)
        }
      } catch {
        stop()
      }
    }

    intervalRef.current = setTimeout(runNext, 300)
  }, [betAmount, onBet, stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false
      if (intervalRef.current) clearTimeout(intervalRef.current)
    }
  }, [])

  return { state, start, stop }
}
