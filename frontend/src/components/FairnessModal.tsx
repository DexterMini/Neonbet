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
import { cn } from '@/lib/utils'

/* ── Visual Game Result Components ────────────────────── */
function KenoResultVisual({ numbers }: { numbers: number[] }) {
  const drawn = numbers
  return (
    <div>
      <div className="text-[11px] text-text-muted uppercase tracking-wider font-semibold mb-2">Drawn Numbers</div>
      <div className="grid grid-cols-8 gap-1.5">
        {Array.from({ length: 40 }, (_, i) => {
          const num = i + 1
          const isDrawn = drawn.includes(num)
          return (
            <div
              key={num}
              className={cn(
                'aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all',
                isDrawn
                  ? 'bg-brand/20 text-brand ring-1 ring-brand/40 shadow-sm shadow-brand/20'
                  : 'bg-surface-light/50 text-text-muted/40 ring-1 ring-white/[0.04]'
              )}
            >
              {num}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DiceResultVisual({ result }: { result: number }) {
  return (
    <div>
      <div className="text-[11px] text-text-muted uppercase tracking-wider font-semibold mb-2">Roll Result</div>
      <div className="relative h-10 bg-surface-light rounded-full overflow-hidden ring-1 ring-white/[0.06]">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand/30 to-brand/10 rounded-full transition-all"
          style={{ width: `${result}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-brand rounded-full shadow-lg shadow-brand/30 flex items-center justify-center"
          style={{ left: `calc(${result}% - 12px)` }}
        >
          <span className="text-[8px] font-black text-background-deep">{result.toFixed(0)}</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-between px-3">
          <span className="text-[10px] text-text-muted font-mono">0</span>
          <span className="text-[10px] text-text-muted font-mono">100</span>
        </div>
      </div>
      <div className="text-center mt-2">
        <span className="text-2xl font-black font-mono text-brand">{result.toFixed(2)}</span>
      </div>
    </div>
  )
}

function CrashResultVisual({ multiplier }: { multiplier: number }) {
  const crashed = multiplier < 200
  return (
    <div>
      <div className="text-[11px] text-text-muted uppercase tracking-wider font-semibold mb-2">Crash Point</div>
      <div className="relative h-24 bg-surface-light rounded-xl overflow-hidden ring-1 ring-white/[0.06] flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-t from-brand/5 to-transparent" />
        <div className="relative text-center">
          <div className={cn(
            'text-4xl font-black font-mono',
            multiplier >= 10 ? 'text-brand animate-multiplier-glow' : multiplier >= 2 ? 'text-brand' : 'text-accent-red'
          )}>
            {multiplier.toFixed(2)}x
          </div>
        </div>
      </div>
    </div>
  )
}

function LimboResultVisual({ multiplier }: { multiplier: number }) {
  return (
    <div>
      <div className="text-[11px] text-text-muted uppercase tracking-wider font-semibold mb-2">Target Multiplier</div>
      <div className="relative h-20 bg-surface-light rounded-xl overflow-hidden ring-1 ring-white/[0.06] flex items-center justify-center">
        <div className={cn(
          'text-3xl font-black font-mono',
          multiplier >= 10 ? 'text-brand' : multiplier >= 2 ? 'text-accent-amber' : 'text-accent-red'
        )}>
          {multiplier.toFixed(2)}x
        </div>
      </div>
    </div>
  )
}

function MinesResultVisual({ gameResult }: { gameResult: string }) {
  // Parse mine positions from "Mines at: 2, 5, 12, ..."
  const match = gameResult.match(/[\d,\s]+/)
  const positions = match ? match[0].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)) : []
  return (
    <div>
      <div className="text-[11px] text-text-muted uppercase tracking-wider font-semibold mb-2">Mine Positions</div>
      <div className="grid grid-cols-5 gap-1.5 max-w-[200px]">
        {Array.from({ length: 25 }, (_, i) => {
          const isMine = positions.includes(i)
          return (
            <div
              key={i}
              className={cn(
                'aspect-square rounded-lg flex items-center justify-center transition-all',
                isMine
                  ? 'bg-accent-red/20 ring-1 ring-accent-red/40'
                  : 'bg-brand/10 ring-1 ring-brand/20'
              )}
            >
              {isMine ? (
                <svg className="w-3.5 h-3.5 text-accent-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="5" /><line x1="12" y1="2" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="7" y2="12" /><line x1="17" y1="12" x2="22" y2="12" />
                </svg>
              ) : (
                <Gem className="w-3 h-3 text-brand/60" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GameResultVisual({ game, gameResult, rawResult }: { game: string; gameResult: string; rawResult: number }) {
  switch (game) {
    case 'keno': {
      const match = gameResult.match(/Numbers:\s*([\d,\s]+)/)
      const numbers = match ? match[1].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)) : []
      return <KenoResultVisual numbers={numbers} />
    }
    case 'dice': {
      const match = gameResult.match(/Roll:\s*([\d.]+)/)
      const result = match ? parseFloat(match[1]) : rawResult * 100
      return <DiceResultVisual result={result} />
    }
    case 'crash': {
      const match = gameResult.match(/Crash at:\s*([\d.]+)/)
      const multiplier = match ? parseFloat(match[1]) : 1
      return <CrashResultVisual multiplier={multiplier} />
    }
    case 'limbo': {
      const match = gameResult.match(/Result:\s*([\d.]+)/)
      const multiplier = match ? parseFloat(match[1]) : 1
      return <LimboResultVisual multiplier={multiplier} />
    }
    case 'mines': {
      return <MinesResultVisual gameResult={gameResult} />
    }
    default:
      return null
  }
}

/* ── Gem icon for mines visual ────────────────────────── */
function Gem({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9z" /><path d="M11 3l1 10" /><path d="M2 9h20" /><path d="m6 3 5 6" /><path d="m18 3-5 6" />
    </svg>
  )
}

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
                    <p className="text-accent-green text-xs mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> You can now verify all bets made with this seed
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
                    className={`rounded-xl border overflow-hidden ${
                      verifyResult.valid
                        ? 'border-green-500/30'
                        : 'border-red-500/30'
                    }`}
                  >
                    {/* Status header */}
                    <div className={`flex items-center gap-3 px-4 py-3 ${
                      verifyResult.valid ? 'bg-green-500/10' : 'bg-accent-red/10'
                    }`}>
                      {verifyResult.valid ? (
                        <CheckCircle2 className="w-5 h-5 text-accent-green" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-accent-red" />
                      )}
                      <span className={`font-bold text-sm ${verifyResult.valid ? 'text-accent-green' : 'text-accent-red'}`}>
                        {verifyResult.valid ? 'Verification Successful' : 'Verification Failed'}
                      </span>
                    </div>

                    {/* Visual game result preview */}
                    {verifyResult.gameResult && (
                      <div className="px-4 pt-4 pb-3">
                        <GameResultVisual game={game} gameResult={verifyResult.gameResult} rawResult={verifyResult.result} />
                      </div>
                    )}
                    
                    {/* Technical details */}
                    <div className="px-4 pb-4 space-y-2 text-sm">
                      <div className="pt-2 border-t border-border/60">
                        <span className="text-text-muted text-[11px] uppercase tracking-wider font-semibold">Calculated Hash</span>
                        <p className="font-mono text-text-primary text-xs break-all mt-1 p-2 bg-background/50 rounded-lg">{verifyResult.calculatedHash}</p>
                      </div>
                      <div>
                        <span className="text-text-muted text-[11px] uppercase tracking-wider font-semibold">Raw Result</span>
                        <p className="font-mono text-text-primary text-xs mt-1">{verifyResult.result.toFixed(8)}</p>
                      </div>
                      {verifyResult.gameResult && (
                        <div>
                          <span className="text-text-muted text-[11px] uppercase tracking-wider font-semibold">Game Result ({game})</span>
                          <p className="font-mono text-brand font-bold text-sm mt-1">{verifyResult.gameResult}</p>
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
