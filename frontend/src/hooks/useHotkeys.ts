'use client'

import { useEffect, useCallback } from 'react'

/**
 * Adds hotkey support for game actions.
 * - Space: trigger primary action (bet/roll/play)
 * - Escape: stop auto-bet
 */
export function useHotkeys(
  onBet: () => void,
  onStop?: () => void,
  enabled: boolean = true
) {
  const handler = useCallback((e: KeyboardEvent) => {
    if (!enabled) return

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
  }, [onBet, onStop, enabled])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}
