'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Volume2, VolumeX, Zap, ZapOff, Keyboard, ShieldAlert, Gauge } from 'lucide-react'
import { useSettingsStore, type GameSpeed } from '@/stores/settingsStore'
import { cn } from '@/lib/utils'

/* ── Toggle row ───────────────────────────────────── */
function ToggleRow({
  icon: Icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: React.ElementType
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="w-4 h-4 text-muted shrink-0" />
        <div className="min-w-0">
          <div className="text-[13px] text-white font-medium leading-tight">{label}</div>
          <div className="text-[11px] text-muted leading-tight">{description}</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors shrink-0',
          value ? 'bg-brand' : 'bg-surface-lighter'
        )}
      >
        <div
          className={cn(
            'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm',
            value ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  )
}

/* ── Speed selector ───────────────────────────────── */
const SPEEDS: { value: GameSpeed; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
  { value: 'instant', label: 'Instant' },
]

function SpeedSelector({
  value,
  onChange,
}: {
  value: GameSpeed
  onChange: (s: GameSpeed) => void
}) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-2.5 mb-2">
        <Gauge className="w-4 h-4 text-muted" />
        <div>
          <div className="text-[13px] text-white font-medium leading-tight">Game Speed</div>
          <div className="text-[11px] text-muted leading-tight">Animation playback speed</div>
        </div>
      </div>
      <div className="flex gap-1 bg-surface rounded-lg p-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={cn(
              'flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all',
              value === s.value
                ? 'bg-brand/15 text-brand ring-1 ring-brand/30'
                : 'text-muted hover:text-white'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Main dropdown ────────────────────────────────── */
export function GameSettingsDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const {
    soundEnabled,
    animationsEnabled,
    hotkeysEnabled,
    maxBetConfirm,
    gameSpeed,
    setSoundEnabled,
    setAnimationsEnabled,
    setHotkeysEnabled,
    setMaxBetConfirm,
    setGameSpeed,
  } = useSettingsStore()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg transition-all ring-1',
          open
            ? 'bg-brand/10 text-brand ring-brand/30'
            : 'bg-white/[0.04] text-muted hover:text-white ring-white/[0.06] hover:ring-white/[0.12]'
        )}
        title="Game Settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-background-secondary rounded-xl border border-border/80 shadow-2xl shadow-black/40 overflow-hidden"
          >
            {/* Header */}
            <div className="px-3.5 py-2.5 border-b border-border/60">
              <div className="text-[13px] text-white font-bold">Settings</div>
            </div>

            {/* Options */}
            <div className="px-3.5 py-1 divide-y divide-border/30">
              <ToggleRow
                icon={soundEnabled ? Volume2 : VolumeX}
                label="Sound Effects"
                description="Game sounds and notifications"
                value={soundEnabled}
                onChange={setSoundEnabled}
              />
              <ToggleRow
                icon={animationsEnabled ? Zap : ZapOff}
                label="Animations"
                description="Visual effects and transitions"
                value={animationsEnabled}
                onChange={setAnimationsEnabled}
              />
              <ToggleRow
                icon={Keyboard}
                label="Hotkeys"
                description="Space to bet, Esc to stop"
                value={hotkeysEnabled}
                onChange={setHotkeysEnabled}
              />
              <ToggleRow
                icon={ShieldAlert}
                label="Max Bet Confirm"
                description="Confirm before large bets"
                value={maxBetConfirm}
                onChange={setMaxBetConfirm}
              />
              <SpeedSelector value={gameSpeed} onChange={setGameSpeed} />
            </div>

            {/* Footer */}
            <div className="px-3.5 py-2 border-t border-border/60 bg-surface/30">
              <div className="text-[10px] text-muted text-center">
                Settings are saved automatically
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
