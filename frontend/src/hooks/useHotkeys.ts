'use client'

import { useEffect, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

/**
 * Adds hotkey support for game actions.
 * - Space: trigger primary action (bet/roll/play)
 * - Escape: stop auto-bet
 * Respects the hotkeysEnabled setting from the settings store.
 */
export function useHotkeys(
  onBet: () => void,
  onStop?: () => void,
  enabled: boolean = true
) {
  const hotkeysEnabled = useSettingsStore((s) => s.hotkeysEnabled)

  const handler = useCallback((e: KeyboardEvent) => {
    if (!enabled || !hotkeysEnabled) return

    // Don't trigger when typing in inputs
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

    if (e.code === 'Space') {
      e.preventDefault()
      onBet()
    }
    if (e.code === 'Escape' && onStop) {
      e.preventDefault()
      onStop()
    }
  }, [onBet, onStop, enabled, hotkeysEnabled])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}
