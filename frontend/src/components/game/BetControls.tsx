'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Keyboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AutoBetPanel } from './AutoBetPanel'
import { type AutoBetConfig, defaultAutoBetConfig, type AutoBetState } from '@/hooks/useAutoBet'

/* ── Shared Bet Controls ─────────────────────────── */
interface BetControlsProps {
  betAmount: string
  onBetAmountChange: (v: string) => void
  disabled?: boolean
  children?: React.ReactNode          // Game-specific controls between bet input and action button
  actionButton: React.ReactNode       // The primary action button
  serverSeedHash: string
  nonce: number
  onShowFairness: () => void
  // Auto-bet
  autoBetConfig?: AutoBetConfig
  onAutoBetConfigChange?: (c: AutoBetConfig) => void
  autoBetState?: AutoBetState
  onAutoBetStart?: () => void
  onAutoBetStop?: () => void
  showAutoTab?: boolean
}

export function BetControls({
  betAmount,
  onBetAmountChange,
  disabled,
  children,
  actionButton,
  serverSeedHash,
  nonce,
  onShowFairness,
  autoBetConfig,
  onAutoBetConfigChange,
  autoBetState,
  onAutoBetStart,
  onAutoBetStop,
  showAutoTab = true,
}: BetControlsProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual')
  const isAutoRunning = autoBetState?.running ?? false

  return (
    <div className="w-full lg:w-[300px] shrink-0">
      <div className="bg-background-secondary rounded-2xl border border-border/60">
        {/* Tabs */}
        <div className="flex border-b border-border/60">
          <button
            onClick={() => !isAutoRunning && setActiveTab('manual')}
            className={cn(
              'flex-1 py-2.5 text-[13px] font-bold transition-colors',
              activeTab === 'manual'
                ? 'text-brand bg-brand/[0.06] border-b-2 border-brand'
                : 'text-muted hover:text-muted-light',
              isAutoRunning && 'opacity-50 cursor-not-allowed'
            )}
          >
            Manual
          </button>
          {showAutoTab && (
            <button
              onClick={() => !isAutoRunning && setActiveTab('auto')}
              className={cn(
                'flex-1 py-2.5 text-[13px] font-bold transition-colors',
                activeTab === 'auto'
                  ? 'text-brand bg-brand/[0.06] border-b-2 border-brand'
                  : 'text-muted hover:text-muted-light',
                isAutoRunning && activeTab !== 'auto' && 'opacity-50 cursor-not-allowed'
              )}
            >
              Auto
            </button>
          )}
        </div>

        <div className="p-3 space-y-3">
          {/* Bet Amount — always shown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Bet Amount</span>
              <div className="flex items-center gap-1 text-[10px] text-muted">
                <Keyboard className="w-3 h-3" />
                <span>Space</span>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={betAmount}
                onChange={e => onBetAmountChange(e.target.value)}
                disabled={disabled || isAutoRunning}
                className="w-full bg-surface border border-border rounded-xl pl-7 pr-3 py-2.5 sm:py-2 font-mono tabular-nums text-sm sm:text-[13px] text-white focus:outline-none focus:border-brand/40 transition-all disabled:opacity-50"
              />
            </div>
            <div className="flex gap-1.5 mt-1.5">
              {['½', '2×', 'Min', 'Max'].map(l => (
                <button
                  key={l}
                  disabled={disabled || isAutoRunning}
                  onClick={() => {
                    if (l === '½') onBetAmountChange((parseFloat(betAmount) / 2).toFixed(2))
                    if (l === '2×') onBetAmountChange((parseFloat(betAmount) * 2).toFixed(2))
                    if (l === 'Min') onBetAmountChange('0.10')
                    if (l === 'Max') onBetAmountChange('1000.00')
                  }}
                  className="flex-1 bg-surface border border-border rounded-lg px-2 py-2.5 sm:py-1.5 text-[12px] sm:text-[11px] font-semibold text-muted-light hover:text-white hover:border-border-light transition-all disabled:opacity-50 active:scale-95"
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Manual tab content */}
          {activeTab === 'manual' && (
            <>
              {children}
              {actionButton}
            </>
          )}

          {/* Auto tab content */}
          {activeTab === 'auto' && autoBetConfig && onAutoBetConfigChange && autoBetState && onAutoBetStart && onAutoBetStop && (
            <>
              {children}
              <AutoBetPanel
                config={autoBetConfig}
                onChange={onAutoBetConfigChange}
                state={autoBetState}
                onStart={onAutoBetStart}
                onStop={onAutoBetStop}
                disabled={disabled}
              />
            </>
          )}

          {/* Seed info */}
          <div className="flex items-center justify-between text-[10px] text-muted pt-1">
            <button onClick={onShowFairness} className="flex items-center gap-1.5 hover:text-brand transition-colors">
              <Shield className="w-3 h-3" />
              <span className="font-mono">{serverSeedHash.substring(0, 12)}...</span>
            </button>
            <span className="font-mono">Nonce: {nonce}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
