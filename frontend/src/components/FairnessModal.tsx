'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Shield, Copy, Check, RefreshCw, Eye, EyeOff, 
  ChevronDown, AlertCircle, CheckCircle2, Hash, Key, Clock
} from 'lucide-react'
import {
  sha256,
  verifyBet,
  generateDiceResult,
  generateCrashResult,
  generateMinesResult,
  generatePlinkoResult,
  generateLimboResult,
  generateKenoResult,
  generateRandomSeed
} from '@/lib/provablyFair'

interface FairnessModalProps {
  isOpen: boolean
  onClose: () => void
  game?: string
  serverSeedHash: string
  clientSeed: string
  nonce: number
  previousServerSeed?: string
  onClientSeedChange: (seed: string) => void
  onRotateSeed: () => void
}

export function FairnessModal({
  isOpen,
  onClose,
  game = 'dice',
  serverSeedHash,
  clientSeed,
  nonce,
  previousServerSeed,
  onClientSeedChange,
  onRotateSeed
}: FairnessModalProps) {
  const [activeTab, setActiveTab] = useState<'seeds' | 'verify'>('seeds')
  const [copied, setCopied] = useState<string | null>(null)
  const [newClientSeed, setNewClientSeed] = useState(clientSeed)
  const [showPrevSeed, setShowPrevSeed] = useState(false)
  
  // Verification state
  const [verifyServerSeed, setVerifyServerSeed] = useState('')
  const [verifyClientSeed, setVerifyClientSeed] = useState('')
  const [verifyNonce, setVerifyNonce] = useState('')
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean
    result: number
    calculatedHash: string
    gameResult?: string
  } | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    setNewClientSeed(clientSeed)
  }, [clientSeed])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSaveClientSeed = () => {
    onClientSeedChange(newClientSeed)
  }

  const handleRandomizeSeed = () => {
    const newSeed = generateRandomSeed(32)
    setNewClientSeed(newSeed)
  }

  const handleVerify = async () => {
    if (!verifyServerSeed || !verifyClientSeed || !verifyNonce) return
    
    setVerifying(true)
    try {
      const nonceNum = parseInt(verifyNonce)
      const result = await verifyBet(
        verifyServerSeed,
        serverSeedHash,
        verifyClientSeed,
        nonceNum
      )
      
      // Calculate game-specific result
      let gameResult = ''
      switch (game) {
        case 'dice':
          const diceResult = await generateDiceResult(verifyServerSeed, verifyClientSeed, nonceNum)
          gameResult = `Roll: ${diceResult.toFixed(2)}`
          break
        case 'crash':
          const crashResult = await generateCrashResult(verifyServerSeed, verifyClientSeed, nonceNum)
          gameResult = `Crash at: ${crashResult.toFixed(2)}x`
          break
        case 'limbo':
          const limboResult = await generateLimboResult(verifyServerSeed, verifyClientSeed, nonceNum)
          gameResult = `Result: ${limboResult.toFixed(2)}x`
          break
        case 'keno':
          const kenoResult = await generateKenoResult(verifyServerSeed, verifyClientSeed, nonceNum)
          gameResult = `Numbers: ${kenoResult.join(', ')}`
          break
      }
      
      setVerifyResult({ ...result, gameResult })
    } catch (error) {
      console.error('Verification error:', error)
    }
    setVerifying(false)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-2xl bg-surface rounded-2xl border border-border overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">Provably Fair</h2>
                <p className="text-text-muted text-sm">Verify every bet cryptographically</p>
              </div>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary p-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {[
              { id: 'seeds', label: 'Seeds', icon: Key },
              { id: 'verify', label: 'Verify', icon: CheckCircle2 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-brand border-b-2 border-brand'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'seeds' && (
              <div className="space-y-6">
                {/* How it works */}
                <div className="p-4 bg-background rounded-xl border border-border">
                  <h3 className="text-text-primary font-semibold mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-brand" />
                    How Provably Fair Works
                  </h3>
                  <ol className="text-text-secondary text-sm space-y-2 list-decimal list-inside">
                    <li>We generate a <span className="text-brand">Server Seed</span> and show you its SHA-256 hash</li>
                    <li>You set your own <span className="text-brand">Client Seed</span> (or use our random one)</li>
                    <li>Each bet increments the <span className="text-brand">Nonce</span> counter</li>
                    <li>Result = HMAC-SHA256(ServerSeed, ClientSeed:Nonce)</li>
                    <li>After rotating seeds, you can verify all previous bets</li>
                  </ol>
                </div>

                {/* Server Seed Hash */}
                <div>
                  <label className="block text-text-secondary text-sm font-medium mb-2">
                    Server Seed Hash (SHA-256)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-3 bg-background rounded-xl border border-border font-mono text-sm text-text-primary break-all">
                      {serverSeedHash || 'Not initialized'}
                    </div>
                    <button
                      onClick={() => copyToClipboard(serverSeedHash, 'hash')}
                      className="p-3 bg-background rounded-xl border border-border text-text-secondary hover:text-text-primary"
                    >
                      {copied === 'hash' ? <Check className="w-5 h-5 text-accent-green" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-text-muted text-xs mt-1">
                    This hash is shown BEFORE you bet. The actual seed is revealed when you rotate.
                  </p>
                </div>

                {/* Previous Server Seed */}
                {previousServerSeed && (
                  <div>
                    <label className="block text-text-secondary text-sm font-medium mb-2">
                      Previous Server Seed (Revealed)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-3 bg-background rounded-xl border border-border font-mono text-sm text-text-primary break-all">
                        {showPrevSeed ? previousServerSeed : '•'.repeat(64)}
                      </div>
                      <button
                        onClick={() => setShowPrevSeed(!showPrevSeed)}
                        className="p-3 bg-background rounded-xl border border-border text-text-secondary hover:text-text-primary"
                      >
                        {showPrevSeed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(previousServerSeed, 'prevSeed')}
                        className="p-3 bg-background rounded-xl border border-border text-text-secondary hover:text-text-primary"
                      >
                        {copied === 'prevSeed' ? <Check className="w-5 h-5 text-accent-green" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-accent-green text-xs mt-1">
                      ✓ You can now verify all bets made with this seed
                    </p>
                  </div>
                )}

                {/* Client Seed */}
                <div>
                  <label className="block text-text-secondary text-sm font-medium mb-2">
                    Client Seed (Your Seed)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newClientSeed}
                      onChange={e => setNewClientSeed(e.target.value)}
                      className="flex-1 p-3 bg-background rounded-xl border border-border font-mono text-sm text-text-primary focus:outline-none focus:border-brand"
                    />
                    <button
                      onClick={handleRandomizeSeed}
                      className="p-3 bg-background rounded-xl border border-border text-text-secondary hover:text-text-primary"
                      title="Generate random seed"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  </div>
                  {newClientSeed !== clientSeed && (
                    <button
                      onClick={handleSaveClientSeed}
                      className="mt-2 px-4 py-2 bg-brand text-text-primary text-sm font-medium rounded-lg hover:bg-brand-dark"
                    >
                      Save Client Seed
                    </button>
                  )}
                </div>

                {/* Nonce */}
                <div>
                  <label className="block text-text-secondary text-sm font-medium mb-2">
                    Nonce (Bet Counter)
                  </label>
                  <div className="p-3 bg-background rounded-xl border border-border font-mono text-sm text-text-primary">
                    {nonce}
                  </div>
                  <p className="text-text-muted text-xs mt-1">
                    Increments with each bet. Resets when you rotate the server seed.
                  </p>
                </div>

                {/* Rotate Seed Button */}
                <button
                  onClick={onRotateSeed}
                  className="w-full py-4 bg-brand text-text-primary font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Rotate Server Seed
                </button>
                <p className="text-text-muted text-xs text-center">
                  This will reveal the current server seed and generate a new one.
                  You&apos;ll be able to verify all bets made with the revealed seed.
                </p>
              </div>
            )}

            {activeTab === 'verify' && (
              <div className="space-y-6">
                {/* Verification Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-text-secondary text-sm font-medium mb-2">
                      Server Seed (Unhashed)
                    </label>
                    <input
                      type="text"
                      value={verifyServerSeed}
                      onChange={e => setVerifyServerSeed(e.target.value)}
                      placeholder="Enter the revealed server seed"
                      className="w-full p-3 bg-background rounded-xl border border-border font-mono text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-text-secondary text-sm font-medium mb-2">
                      Client Seed
                    </label>
                    <input
                      type="text"
                      value={verifyClientSeed}
                      onChange={e => setVerifyClientSeed(e.target.value)}
                      placeholder="Enter the client seed used"
                      className="w-full p-3 bg-background rounded-xl border border-border font-mono text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-text-secondary text-sm font-medium mb-2">
                      Nonce
                    </label>
                    <input
                      type="number"
                      value={verifyNonce}
                      onChange={e => setVerifyNonce(e.target.value)}
                      placeholder="Enter the nonce (bet number)"
                      className="w-full p-3 bg-background rounded-xl border border-border font-mono text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-brand"
                    />
                  </div>

                  <button
                    onClick={handleVerify}
                    disabled={verifying || !verifyServerSeed || !verifyClientSeed || !verifyNonce}
                    className="w-full py-4 bg-brand text-text-primary font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {verifying ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    Verify Bet
                  </button>
                </div>

                {/* Verification Result */}
                {verifyResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl border ${
                      verifyResult.valid
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-accent-red/10 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {verifyResult.valid ? (
                        <CheckCircle2 className="w-6 h-6 text-accent-green" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-accent-red" />
                      )}
                      <span className={`font-bold ${verifyResult.valid ? 'text-accent-green' : 'text-accent-red'}`}>
                        {verifyResult.valid ? 'Verification Successful!' : 'Verification Failed'}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-text-secondary">Calculated Hash:</span>
                        <p className="font-mono text-text-primary break-all">{verifyResult.calculatedHash}</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Raw Result:</span>
                        <p className="font-mono text-text-primary">{verifyResult.result.toFixed(8)}</p>
                      </div>
                      {verifyResult.gameResult && (
                        <div>
                          <span className="text-text-secondary">Game Result ({game}):</span>
                          <p className="font-mono text-brand font-bold">{verifyResult.gameResult}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* External Verification */}
                <div className="p-4 bg-background rounded-xl border border-border">
                  <h3 className="text-text-primary font-semibold mb-2">Verify Externally</h3>
                  <p className="text-text-secondary text-sm mb-3">
                    You can verify the results using any HMAC-SHA256 calculator:
                  </p>
                  <code className="block p-3 bg-surface rounded-lg text-xs text-text-secondary font-mono">
                    HMAC_SHA256(serverSeed, clientSeed:nonce)
                  </code>
                  <p className="text-text-muted text-xs mt-2">
                    The first 8 hex characters converted to integer, divided by 2^32, gives the result.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
