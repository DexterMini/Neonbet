'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import { CircleDot, RefreshCw, Shield, Zap, TrendingUp, Sparkles } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'
import { useAutoBet, defaultAutoBetConfig, type AutoBetConfig } from '@/hooks/useAutoBet'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useDemoBalance } from '@/stores/demoBalanceStore'

interface WheelSegment {
  value: number
  color: string
}

type RiskLevel = 'low' | 'medium' | 'high'

/* ── Floating particles ───────────────────────────── */
const WHEEL_PARTICLE_COLORS = ['#facc15', '#fbbf24', '#f59e0b', '#fde68a', '#eab308', '#fef08a']
function FloatingSparkles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {WHEEL_PARTICLE_COLORS.map((c, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${5 + i * 16}%` }}
          animate={{ opacity: [0, 0.3, 0], y: '-10%', x: `${5 + i * 16 + (Math.random() - 0.5) * 10}%` }}
          transition={{ duration: 5 + Math.random() * 4, repeat: Infinity, delay: i * 0.9, ease: 'easeOut' }}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

const WHEEL_CONFIGS: Record<number, Record<RiskLevel, WheelSegment[]>> = {
  10: {
    low: [
      { value: 1.5, color: '#71717a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.7, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
    ],
    medium: [
      { value: 1.2, color: '#52525b' },
      { value: 1.5, color: '#71717a' },
      { value: 1.2, color: '#52525b' },
      { value: 1.9, color: '#34d399' },
      { value: 1, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1.5, color: '#71717a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
    ],
    high: [
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 4.9, color: '#a78bfa' },
      { value: 0, color: '#27272a' },
      { value: 2, color: '#34d399' },
      { value: 0, color: '#27272a' },
      { value: 1.5, color: '#71717a' },
      { value: 1.5, color: '#71717a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
    ],
  },
  20: {
    low: [
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 0.7, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 1.5, color: '#71717a' },
      { value: 1, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1.7, color: '#71717a' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
    ],
    medium: [
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 1.5, color: '#71717a' },
      { value: 1, color: '#52525b' },
      { value: 1.5, color: '#71717a' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 4.5, color: '#a78bfa' },
      { value: 1, color: '#52525b' },
      { value: 0, color: '#27272a' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 2, color: '#34d399' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1.5, color: '#71717a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 1.2, color: '#52525b' },
    ],
    high: [
      { value: 0, color: '#27272a' },
      { value: 9.8, color: '#c084fc' },
      { value: 0, color: '#27272a' },
      { value: 4, color: '#a78bfa' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 1.5, color: '#71717a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 1, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0, color: '#27272a' },
      { value: 1.5, color: '#71717a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
    ],
  },
  30: {
    low: [
      { value: 0.5, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1.5, color: '#71717a' },
      { value: 1, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1.5, color: '#71717a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 3, color: '#22d3ee' },
      { value: 1, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
    ],
    medium: [
      { value: 0.8, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 1.2, color: '#52525b' },
      { value: 1.8, color: '#34d399' },
      { value: 0, color: '#27272a' },
      { value: 0.3, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 0.3, color: '#3f3f46' },
      { value: 6.7, color: '#a78bfa' },
      { value: 1, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 2, color: '#34d399' },
      { value: 1.5, color: '#71717a' },
      { value: 0, color: '#27272a' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1.5, color: '#71717a' },
      { value: 2, color: '#34d399' },
      { value: 0, color: '#27272a' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0.3, color: '#3f3f46' },
      { value: 1.5, color: '#71717a' },
    ],
    high: [
      { value: 0, color: '#27272a' },
      { value: 0.4, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0.4, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1.5, color: '#71717a' },
      { value: 5, color: '#a78bfa' },
      { value: 2.5, color: '#22d3ee' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 1.5, color: '#71717a' },
      { value: 0, color: '#27272a' },
      { value: 15, color: '#fbbf24' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 1, color: '#52525b' },
      { value: 0.4, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
    ],
  },
  40: {
    low: [
      { value: 0.5, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 2, color: '#34d399' },
      { value: 1.2, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 3.8, color: '#22d3ee' },
      { value: 1, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1.5, color: '#71717a' },
      { value: 1.5, color: '#71717a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
    ],
    medium: [
      { value: 0, color: '#27272a' },
      { value: 3, color: '#22d3ee' },
      { value: 0, color: '#27272a' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1.5, color: '#71717a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.5, color: '#71717a' },
      { value: 1.2, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.2, color: '#3f3f46' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0.3, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 2, color: '#34d399' },
      { value: 10.1, color: '#c084fc' },
      { value: 0, color: '#27272a' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 1.2, color: '#52525b' },
      { value: 1.8, color: '#34d399' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.3, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 0, color: '#27272a' },
      { value: 1, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 2, color: '#34d399' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0.2, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 1.5, color: '#71717a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
    ],
    high: [
      { value: 0, color: '#27272a' },
      { value: 18.5, color: '#fbbf24' },
      { value: 0, color: '#27272a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 1, color: '#52525b' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 1, color: '#52525b' },
      { value: 1.5, color: '#71717a' },
      { value: 0, color: '#27272a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 2, color: '#34d399' },
      { value: 0, color: '#27272a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 3, color: '#22d3ee' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 5, color: '#a78bfa' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 1.5, color: '#71717a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 2, color: '#34d399' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
    ],
  },
  50: {
    low: [
      { value: 0.8, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 4.8, color: '#a78bfa' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.5, color: '#71717a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.5, color: '#71717a' },
      { value: 1.5, color: '#71717a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 1, color: '#52525b' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 2, color: '#34d399' },
      { value: 1.2, color: '#52525b' },
      { value: 2, color: '#34d399' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1.2, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
    ],
    medium: [
      { value: 0.3, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0.2, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 3, color: '#22d3ee' },
      { value: 1, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 1.2, color: '#52525b' },
      { value: 0.8, color: '#3f3f46' },
      { value: 1.5, color: '#71717a' },
      { value: 5, color: '#a78bfa' },
      { value: 0, color: '#27272a' },
      { value: 1, color: '#52525b' },
      { value: 0.2, color: '#3f3f46' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 1, color: '#52525b' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 1.5, color: '#71717a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.2, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 1.2, color: '#52525b' },
      { value: 0.3, color: '#3f3f46' },
      { value: 1, color: '#52525b' },
      { value: 0.3, color: '#3f3f46' },
      { value: 1.5, color: '#71717a' },
      { value: 2, color: '#34d399' },
      { value: 0.2, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 1.2, color: '#52525b' },
      { value: 2, color: '#34d399' },
      { value: 0.2, color: '#3f3f46' },
      { value: 1.8, color: '#34d399' },
      { value: 0, color: '#27272a' },
      { value: 0.8, color: '#3f3f46' },
      { value: 11.1, color: '#c084fc' },
      { value: 0, color: '#27272a' },
      { value: 1, color: '#52525b' },
      { value: 1.5, color: '#71717a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0.8, color: '#3f3f46' },
      { value: 0.3, color: '#3f3f46' },
    ],
    high: [
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 5, color: '#a78bfa' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 1, color: '#52525b' },
      { value: 0, color: '#27272a' },
      { value: 0.2, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 1, color: '#52525b' },
      { value: 0, color: '#27272a' },
      { value: 0.3, color: '#3f3f46' },
      { value: 3, color: '#22d3ee' },
      { value: 0, color: '#27272a' },
      { value: 0.3, color: '#3f3f46' },
      { value: 2, color: '#34d399' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 3, color: '#22d3ee' },
      { value: 0.3, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 1.5, color: '#71717a' },
      { value: 26, color: '#fbbf24' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 1.5, color: '#71717a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 0.5, color: '#3f3f46' },
      { value: 0, color: '#27272a' },
      { value: 0, color: '#27272a' },
      { value: 2, color: '#34d399' },
      { value: 0, color: '#27272a' },
      { value: 0.3, color: '#3f3f46' },
    ],
  },
}

export default function WheelPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const {
    initialized, serverSeedHash, clientSeed, nonce, previousServerSeed,
    generateBet, rotateSeed, setClientSeed,
  } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing, fetchBalances, balances, balancesLoaded } = useGameStore()
  const sessionStats = useSessionStats()
  const { balance: demoBalance, deduct, credit } = useDemoBalance()

  const [betAmount, setBetAmount] = useState('10.00')
  const [wheelSegments, setWheelSegments] = useState(10)
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium')
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<WheelSegment | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [showFairness, setShowFairness] = useState(false)
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)

  const segments = WHEEL_CONFIGS[wheelSegments]?.[riskLevel] || WHEEL_CONFIGS[10].medium

  // Group physical segments into unique multiplier entries with computed probability
  const uniqueSegments = useMemo(() => {
    const counts = new Map<number, { color: string; count: number }>()
    segments.forEach(seg => {
      const e = counts.get(seg.value)
      if (e) e.count++
      else counts.set(seg.value, { color: seg.color, count: 1 })
    })
    return Array.from(counts.entries())
      .map(([value, { color, count }]) => ({ value, color, probability: count / segments.length }))
      .sort((a, b) => b.value - a.value)
  }, [segments])

  useEffect(() => {
    if (isAuthenticated) fetchBalances()
  }, [isAuthenticated, fetchBalances])

  const displayBalance = isAuthenticated
    ? (balances['btc']?.available ?? 0)
    : demoBalance

  // Draw wheel
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 20

    ctx.clearRect(0, 0, width, height)

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-centerX, -centerY)

    // Outer glow
    const gradient = ctx.createRadialGradient(centerX, centerY, radius - 10, centerX, centerY, radius + 30)
    gradient.addColorStop(0, 'rgba(167, 139, 250, 0.25)')
    gradient.addColorStop(1, 'rgba(167, 139, 250, 0)')
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius + 30, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()

    // Outer ring
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.3)'
    ctx.lineWidth = 3
    ctx.stroke()

    // Draw segments
    const segmentAngle = (2 * Math.PI) / segments.length
    segments.forEach((segment, i) => {
      const startAngle = i * segmentAngle - Math.PI / 2
      const endAngle = startAngle + segmentAngle

      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = segment.color
      ctx.fill()
      ctx.strokeStyle = '#0A0B0F'
      ctx.lineWidth = 2
      ctx.stroke()

      // Inner highlight
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.closePath()
      const segGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
      segGrad.addColorStop(0, 'rgba(255,255,255,0.06)')
      segGrad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = segGrad
      ctx.fill()

      // Text
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(startAngle + segmentAngle / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = segment.value >= 5 ? '#000' : '#fff'
      ctx.font = 'bold 12px monospace'
      ctx.fillText(`${segment.value}x`, radius - 15, 4)
      ctx.restore()
    })

    // Center circle
    const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 35)
    centerGradient.addColorStop(0, '#1a1530')
    centerGradient.addColorStop(1, '#0e0a1a')
    ctx.beginPath()
    ctx.arc(centerX, centerY, 35, 0, Math.PI * 2)
    ctx.fillStyle = centerGradient
    ctx.fill()
    ctx.strokeStyle = '#a78bfa'
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.fillStyle = '#a78bfa'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('◎', centerX, centerY)

    ctx.restore()

    // Pointer
    ctx.beginPath()
    ctx.moveTo(centerX + radius + 15, centerY)
    ctx.lineTo(centerX + radius - 15, centerY - 18)
    ctx.lineTo(centerX + radius - 15, centerY + 18)
    ctx.closePath()
    const pointerGradient = ctx.createLinearGradient(centerX + radius - 15, centerY, centerX + radius + 15, centerY)
    pointerGradient.addColorStop(0, '#a78bfa')
    pointerGradient.addColorStop(1, '#8b5cf6')
    ctx.fillStyle = pointerGradient
    ctx.fill()
    ctx.shadowColor = '#a78bfa'
    ctx.shadowBlur = 15
    ctx.fill()
    ctx.shadowBlur = 0

  }, [rotation, segments])

  // Spin the wheel
  const handleSpin = useCallback(async (amount?: number): Promise<{ won: boolean; profit: number }> => {
    const bet = amount ?? parseFloat(betAmount)
    if (isSpinning || isPlacing) return { won: false, profit: 0 }
    if (!initialized) { toast.error('Initializing provably fair system...'); return { won: false, profit: 0 } }
    if (bet <= 0 || bet > displayBalance) { toast.error('Invalid bet amount'); return { won: false, profit: 0 } }

    setIsSpinning(true)
    setShowResult(false)
    if (!isAuthenticated) deduct(bet)

    let resultSegment: WheelSegment
    let resultIdx: number

    try {
      if (isAuthenticated) {
        const data = await placeBet('wheel', betAmount, 'usdt', {})
        resultIdx = data.result_data?.segment_index ?? 0
        resultSegment = segments[resultIdx % segments.length]
      } else {
        const { result: ri } = await generateBet('wheel', { segments: segments.length })
        resultIdx = (ri as number) % segments.length
        resultSegment = segments[resultIdx]
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error placing bet')
      if (!isAuthenticated) credit(bet)
      setIsSpinning(false)
      return { won: false, profit: -bet }
    }

    const segmentAngle = 360 / segments.length
    const targetAngle = 360 - (resultIdx * segmentAngle + segmentAngle / 2)
    const spins = 5 + Math.floor(Math.random() * 3)
    const finalRotation = spins * 360 + targetAngle

    const duration = 5000
    const startTime = Date.now()
    const startRotation = rotation

    return new Promise<{ won: boolean; profit: number }>((resolve) => {
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        const currentRotation = startRotation + (finalRotation * eased)
        setRotation(currentRotation % 360)

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setResult(resultSegment)
          setShowResult(true)
          setIsSpinning(false)

          const payout = bet * resultSegment.value
          const won = resultSegment.value > 0
          const profit = won ? payout - bet : -bet
          if (won) {
            if (!isAuthenticated) credit(payout)
            sessionStats.recordBet(true, bet, payout - bet, resultSegment.value)
            toast.success(`${resultSegment.value}x! Won $${payout.toFixed(2)}`)
          } else {
            sessionStats.recordBet(false, bet, -bet, 0)
            toast.error(`0x - Lost $${bet.toFixed(2)}`)
          }
          resolve({ won, profit })
        }
      }
      requestAnimationFrame(animate)
    })
  }, [betAmount, isSpinning, isPlacing, initialized, displayBalance, isAuthenticated, placeBet, generateBet, segments, rotation, sessionStats])

  const autoBetHandler = useCallback(async (amount: number) => handleSpin(amount), [handleSpin])
  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)
  useHotkeys(() => { if (!isSpinning && !autoBetState.running) handleSpin() }, () => autoBetStop(), !isSpinning)

  return (
    <GameLayout>
      <div className="p-3 sm:p-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <SessionStatsBar />

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left: Bet Controls */}
            <BetControls
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              disabled={isSpinning}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              autoBetConfig={autoBetConfig}
              onAutoBetConfigChange={setAutoBetConfig}
              autoBetState={autoBetState}
              onAutoBetStart={autoBetStart}
              onAutoBetStop={autoBetStop}
              actionButton={
                <button onClick={() => handleSpin()} disabled={isSpinning}
                  className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                    isSpinning ? 'bg-surface text-muted cursor-not-allowed' :
                    'bg-gradient-to-r from-violet-500 to-purple-400 text-white shadow-lg shadow-violet-500/30 hover:brightness-110'
                  }`}>
                  {isSpinning ? <><RefreshCw className="w-4 h-4 animate-spin" />Spinning...</> : <><Sparkles className="w-4 h-4" />Spin Wheel</>}
                </button>
              }
            >
              {/* Segments */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Segments</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[10, 20, 30, 40, 50].map(count => (
                    <button key={count} onClick={() => setWheelSegments(count)} disabled={isSpinning}
                      className={`py-2 rounded-lg font-semibold text-sm transition-all ${
                        wheelSegments === count
                          ? 'bg-violet-500/20 border border-violet-500/50 text-violet-300 shadow-sm shadow-violet-500/20'
                          : 'bg-surface border border-border text-muted hover:text-white hover:border-violet-500/30'
                      } disabled:opacity-50`}>
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk Level */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-2 mb-1.5">
                  <Zap className="w-3.5 h-3.5 text-violet-400" />Risk Level
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['low', 'medium', 'high'] as RiskLevel[]).map(level => (
                    <button key={level} onClick={() => setRiskLevel(level)} disabled={isSpinning}
                      className={`py-2 rounded-lg font-semibold text-sm capitalize transition-all ${
                        riskLevel === level
                          ? level === 'low' ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                            : level === 'medium' ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                            : 'bg-red-500/20 border border-red-500/50 text-red-400'
                          : 'bg-surface border border-border text-muted hover:text-white'
                      } disabled:opacity-50`}>
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multipliers Preview */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-2 mb-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-violet-400" />Possible Wins
                </span>
                <div className="bg-surface rounded-xl p-2 max-h-40 overflow-y-auto border border-border scrollbar-thin">
                  {uniqueSegments.map((seg, i) => (
                    <div key={i} className="flex justify-between items-center py-1 px-1.5 border-b border-white/[0.03] last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm ring-1 ring-white/10" style={{ backgroundColor: seg.color }} />
                        <span className={`font-mono tabular-nums text-xs ${
                          seg.value >= 10 ? 'text-amber-400' : seg.value >= 5 ? 'text-violet-400' : seg.value > 0 ? 'text-white' : 'text-muted'
                        }`}>{seg.value}x</span>
                      </div>
                      <span className="text-[10px] text-muted font-mono">{(seg.probability * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last Result in sidebar */}
              <AnimatePresence>
                {showResult && result && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className={`p-3 rounded-xl text-center ring-1 ${
                      result.value > 0 ? 'bg-brand/[0.06] ring-brand/20' : 'bg-accent-red/10 ring-accent-red/20'
                    }`}>
                    <div className={`text-2xl font-bold font-mono ${
                      result.value >= 10 ? 'text-amber-400' : result.value > 0 ? 'text-brand' : 'text-accent-red'
                    }`}>{result.value}x</div>
                    <div className="text-xs text-muted mt-1">
                      {result.value > 0
                        ? <span className="text-brand">+${(parseFloat(betAmount) * result.value).toFixed(2)}</span>
                        : 'Better luck next time!'}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BetControls>

            {/* Right: Game Area — Premium Scene */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #0e0a1a 0%, #0d0e16 40%, #0a0f12 100%)' }}>
                <FloatingSparkles />

                {/* Ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-violet-400/20"
                      style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.25) 0%, rgba(167,139,250,0.08) 100%)' }}>
                      <CircleDot className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">Wheel</h2>
                      <p className="text-violet-300/30 text-[10px] mt-0.5">Spin to win up to 100x</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowFairness(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/[0.04] text-muted hover:text-white ring-1 ring-white/[0.06] transition-all">
                      <Shield className="w-3 h-3" />Fairness
                    </button>
                    <GameSettingsDropdown />
                  </div>
                </div>

                {/* Wheel Canvas */}
                <div className="relative z-10 p-6 flex justify-center">
                  {isSpinning && (
                    <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1, repeat: Infinity }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-violet-500/10 rounded-full blur-[80px]" />
                  )}
                  <canvas ref={canvasRef} width={400} height={400} className="rounded-full max-w-full relative z-10" />
                </div>

                {/* Result Display */}
                <AnimatePresence>
                  {showResult && result && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                      className="relative z-10 mx-5 mb-5">
                      <div className={`p-5 rounded-2xl text-center backdrop-blur-sm ring-1 ${
                        result.value > 0 ? 'bg-brand/[0.06] ring-brand/20' : 'bg-accent-red/[0.06] ring-accent-red/20'
                      }`}>
                        {result.value > 0 && (
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
                            style={{ background: `radial-gradient(circle, ${result.value >= 10 ? 'rgba(251,191,36,0.12)' : 'rgba(0,232,123,0.12)'} 0%, transparent 70%)` }} />
                        )}
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                          className={`text-5xl sm:text-6xl font-black font-mono tabular-nums relative z-10 ${
                            result.value >= 10 ? 'text-amber-400' : result.value > 0 ? 'text-brand' : 'text-accent-red'
                          }`}
                          style={{ textShadow: result.value > 0
                            ? (result.value >= 10 ? '0 0 60px rgba(251,191,36,0.5)' : '0 0 60px rgba(0,232,123,0.5)')
                            : '0 0 40px rgba(255,71,87,0.4)' }}>
                          {result.value}x
                        </motion.div>
                        <div className="text-base text-muted mt-2 font-mono relative z-10">
                          {result.value > 0
                            ? <span className="text-brand font-bold">+${(parseFloat(betAmount) * result.value).toFixed(2)}</span>
                            : 'Better luck next time!'}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <LiveBetsTable game="wheel" />
            </div>
          </div>

          <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="wheel"
            serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
            previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
        </div>
      </div>
    </GameLayout>
  )
}
