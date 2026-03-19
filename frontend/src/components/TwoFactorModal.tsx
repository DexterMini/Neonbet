'use client'

import { useEffect, useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui'

interface TwoFactorModalProps {
  open: boolean
  amount: number
  currency?: string
  busy?: boolean
  onClose: () => void
  onConfirm: (code: string) => void | Promise<void>
}

export function TwoFactorModal({
  open,
  amount,
  currency = 'USDT',
  busy = false,
  onClose,
  onConfirm,
}: TwoFactorModalProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setCode('')
      setError('')
    }
  }, [open])

  const handleConfirm = async () => {
    const trimmed = code.replace(/\s+/g, '')
    if (!trimmed) {
      setError('Enter the 2FA code from your authenticator app.')
      return
    }
    setError('')
    await onConfirm(trimmed)
  }

  return (
    <Modal open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>Two-factor required</ModalTitle>
          <ModalDescription>
            This bet ({amount.toFixed(2)} {currency}) requires 2FA confirmation.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-2">
              2FA code
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            {error && <p className="mt-2 text-xs text-accent-red">{error}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted hover:text-white transition-colors"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand text-background-deep hover:brightness-110 transition-all disabled:opacity-60"
            disabled={busy}
          >
            Confirm bet
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
