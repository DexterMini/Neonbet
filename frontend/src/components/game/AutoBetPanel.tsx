'use client'

import { type AutoBetConfig, defaultAutoBetConfig, type AutoBetState } from '@/hooks/useAutoBet'
import { TrendingUp, TrendingDown, Zap, Ban, Infinity as InfinityIcon, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

/* ── Auto-Bet Settings Panel ──────────────────────── */
interface AutoBetPanelProps {
  config: AutoBetConfig
  onChange: (config: AutoBetConfig) => void
  state: AutoBetState
  onStart: () => void
  onStop: () => void
  disabled?: boolean
}

export function AutoBetPanel({ config, onChange, state, onStart, onStop, disabled }: AutoBetPanelProps) {
  const update = (patch: Partial<AutoBetConfig>) => onChange({ ...config, ...patch })
  const betsRemaining = config.numberOfBets > 0 ? Math.max(0, config.numberOfBets - state.betsPlaced) : null

  return (
    <div className="space-y-3">
      {/* Number of Bets */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Number of Bets</span>
          <button
            onClick={() => update({ numberOfBets: config.numberOfBets === 0 ? 10 : 0 })}
            className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors',
              config.numberOfBets === 0
                ? 'bg-brand/15 text-brand'
                : 'bg-surface text-muted hover:text-white'
            )}
          >
            {config.numberOfBets === 0 ? '∞' : 'Set'}
          </button>
        </div>
        <div className="relative">
          <input
            type="number"
            value={config.numberOfBets || ''}
            onChange={e => update({ numberOfBets: parseInt(e.target.value) || 0 })}
            placeholder="∞ Infinite"
            disabled={state.running}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2 font-mono tabular-nums text-[13px] text-white focus:outline-none focus:border-brand/40 transition-all disabled:opacity-50"
          />
          {config.numberOfBets === 0 && (
            <InfinityIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          )}
        </div>
      </div>

      {/* Running stats — Total Wagered & Profits */}
      <AnimatePresence>
        {state.running && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-surface rounded-xl border border-brand/20 divide-y divide-border/40">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">Total Wagered</div>
                  <div className="text-[15px] font-bold text-white font-mono tabular-nums">${state.totalWagered.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted uppercase tracking-wider">Bets</div>
                  <div className="text-[15px] font-bold text-white font-mono tabular-nums">{state.betsPlaced}</div>
                </div>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">Total Profits</div>
                  <div className={cn(
                    'text-[15px] font-bold font-mono tabular-nums flex items-center gap-1',
                    state.totalProfit >= 0 ? 'text-brand' : 'text-accent-red'
                  )}>
                    ${Math.abs(state.totalProfit).toFixed(2)}
                    {state.totalProfit !== 0 && (
                      <span className={cn(
                        'w-2 h-2 rounded-full inline-block',
                        state.totalProfit > 0 ? 'bg-brand' : 'bg-accent-red'
                      )} />
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted uppercase tracking-wider">W / L</div>
                  <div className="text-[13px] font-mono tabular-nums">
                    <span className="text-brand font-bold">{state.wins}</span>
                    <span className="text-muted mx-0.5">/</span>
                    <span className="text-accent-red font-bold">{state.losses}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* On Win / On Loss — compact inline style */}
      <div className="bg-surface rounded-xl border border-border p-3 space-y-2.5">
        {/* On Win */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-light">On Win</span>
            {config.onWin === 'increase' ? (
              <button
                onClick={() => update({ onWin: 'reset', onWinPercent: 0 })}
                className="text-[11px] font-bold text-brand hover:text-brand-light transition-colors"
              >
                +{config.onWinPercent.toFixed(2)}%
              </button>
            ) : (
              <button
                onClick={() => update({ onWin: 'increase', onWinPercent: config.onWinPercent || 200 })}
                className="text-[11px] font-bold text-muted-light hover:text-brand transition-colors"
              >
                RESET
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-light">On Loss</span>
            {config.onLoss === 'increase' ? (
              <button
                onClick={() => update({ onLoss: 'reset', onLossPercent: 0 })}
                className="text-[11px] font-bold text-accent-red hover:brightness-125 transition-colors"
              >
                +{config.onLossPercent.toFixed(2)}%
              </button>
            ) : (
              <button
                onClick={() => update({ onLoss: 'increase', onLossPercent: config.onLossPercent || 100 })}
                className="text-[11px] font-bold text-muted-light hover:text-accent-red transition-colors"
              >
                RESET
              </button>
            )}
          </div>
        </div>

        {/* Editable percentages when "increase" is active */}
        <AnimatePresence>
          {(config.onWin === 'increase' || config.onLoss === 'increase') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 pt-1">
                {config.onWin === 'increase' && (
                  <div className="flex-1">
                    <span className="text-[9px] text-muted uppercase block mb-1">Win increase %</span>
                    <div className="relative">
                      <input
                        type="number"
                        value={config.onWinPercent}
                        onChange={e => update({ onWinPercent: parseInt(e.target.value) || 0 })}
                        disabled={state.running}
                        className="w-full bg-background-secondary border border-border rounded-lg px-2.5 py-1.5 pr-7 font-mono tabular-nums text-[12px] text-white focus:outline-none focus:border-brand/40 transition-all disabled:opacity-50"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted text-[11px]">%</span>
                    </div>
                  </div>
                )}
                {config.onLoss === 'increase' && (
                  <div className="flex-1">
                    <span className="text-[9px] text-muted uppercase block mb-1">Loss increase %</span>
                    <div className="relative">
                      <input
                        type="number"
                        value={config.onLossPercent}
                        onChange={e => update({ onLossPercent: parseInt(e.target.value) || 0 })}
                        disabled={state.running}
                        className="w-full bg-background-secondary border border-border rounded-lg px-2.5 py-1.5 pr-7 font-mono tabular-nums text-[12px] text-white focus:outline-none focus:border-brand/40 transition-all disabled:opacity-50"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted text-[11px]">%</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stop conditions inline */}
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-light font-medium">Stop on Profit</span>
            <div className="relative">
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-brand" />
              <input
                type="number"
                value={config.stopOnProfit || ''}
                onChange={e => update({ stopOnProfit: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                disabled={state.running}
                className="w-24 bg-background-secondary border border-border rounded-lg pl-6 pr-2 py-1 font-mono tabular-nums text-[12px] text-white text-right focus:outline-none focus:border-brand/40 transition-all disabled:opacity-50"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-light font-medium">Stop on Loss</span>
            <div className="relative">
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-accent-red" />
              <input
                type="number"
                value={config.stopOnLoss || ''}
                onChange={e => update({ stopOnLoss: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                disabled={state.running}
                className="w-24 bg-background-secondary border border-border rounded-lg pl-6 pr-2 py-1 font-mono tabular-nums text-[12px] text-white text-right focus:outline-none focus:border-brand/40 transition-all disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Start / Stop button */}
      {!state.running ? (
        <button
          onClick={onStart}
          disabled={disabled}
          className="w-full py-3.5 bg-brand text-background-deep font-bold text-[14px] rounded-xl shadow-glow-brand-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />Start Autoplay
        </button>
      ) : (
        <motion.button
          onClick={onStop}
          animate={{
            boxShadow: [
              '0 0 15px rgba(0,232,123,0.2)',
              '0 0 30px rgba(0,232,123,0.4)',
              '0 0 15px rgba(0,232,123,0.2)',
            ]
          }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-full py-3.5 bg-brand text-background-deep font-black text-[14px] rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          <Ban className="w-4 h-4" />
          Stop Autoplay{betsRemaining !== null ? ` (${betsRemaining})` : state.betsPlaced > 0 ? ` (${state.betsPlaced})` : ''}
        </motion.button>
      )}
    </div>
  )
}
