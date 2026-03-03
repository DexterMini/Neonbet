'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import {
  useChatStore,
  type ChatMessage,
} from '@/stores/chatStore'
import {
  X, Send, CloudRain, Gift, Crown, Users,
  TrendingUp, ArrowRight, Sparkles, Volume2,
  VolumeX, ChevronDown, Coins, Zap,
} from 'lucide-react'

/* ── VIP badge colors ───────────────────────────────── */
const vipColors: Record<number, string> = {
  0: '',
  1: 'text-accent-blue',
  2: 'text-accent-purple',
  3: 'text-accent-amber',
  4: 'text-accent-red',
  5: 'text-brand',
  6: 'text-accent-cyan',
}

const vipBg: Record<number, string> = {
  0: '',
  1: 'bg-accent-blue/10',
  2: 'bg-accent-purple/10',
  3: 'bg-accent-amber/10',
  4: 'bg-accent-red/10',
  5: 'bg-brand/10',
  6: 'bg-accent-cyan/10',
}

function VipBadge({ level }: { level: number }) {
  if (level < 1) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold',
        vipBg[level] || 'bg-brand/10',
        vipColors[level] || 'text-brand'
      )}
    >
      <Crown className="w-2.5 h-2.5" />
      {level}
    </span>
  )
}

/* ── Time formatting ────────────────────────────────── */
function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/* ── Message component ──────────────────────────────── */
function ChatBubble({
  msg,
  onTipClick,
}: {
  msg: ChatMessage
  onTipClick: (username: string) => void
}) {
  if (msg.type === 'system') {
    return (
      <div className="px-3 py-1.5 text-center">
        <span className="text-[11px] text-muted italic">{msg.content}</span>
      </div>
    )
  }

  if (msg.type === 'rain') {
    return (
      <div className="mx-2 my-1.5 p-3 rounded-xl bg-gradient-to-r from-accent-cyan/10 via-accent-blue/10 to-accent-purple/10 border border-accent-cyan/20">
        <div className="flex items-center gap-2 mb-1">
          <CloudRain className="w-4 h-4 text-accent-cyan animate-pulse" />
          <span className="text-[12px] font-bold text-accent-cyan">Rain!</span>
        </div>
        <p className="text-[11px] text-muted-light">
          <span className="text-white font-semibold">{msg.user.name}</span> made it rain{' '}
          <span className="text-accent-cyan font-mono font-bold">
            {msg.rainAmount} {msg.rainCurrency}
          </span>{' '}
          to {msg.rainRecipients} lucky chatters!
        </p>
      </div>
    )
  }

  if (msg.type === 'tip') {
    return (
      <div className="mx-2 my-1 p-2.5 rounded-xl bg-accent-amber/5 border border-accent-amber/15">
        <div className="flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5 text-accent-amber" />
          <span className="text-[11px] text-muted-light">
            <button
              onClick={() => onTipClick(msg.user.name)}
              className="text-white font-semibold hover:text-brand transition-colors"
            >
              {msg.user.name}
            </button>{' '}
            tipped{' '}
            <button
              onClick={() => onTipClick(msg.recipient!)}
              className="text-white font-semibold hover:text-brand transition-colors"
            >
              {msg.recipient}
            </button>{' '}
            <span className="text-accent-amber font-mono font-bold">
              {msg.amount} {msg.currency}
            </span>
          </span>
        </div>
      </div>
    )
  }

  if (msg.type === 'win') {
    return (
      <div className="mx-2 my-1 p-2.5 rounded-xl bg-brand/5 border border-brand/15">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onTipClick(msg.user.name)}
                className="text-[12px] font-semibold text-white hover:text-brand transition-colors truncate"
              >
                {msg.user.name}
              </button>
              <VipBadge level={msg.user.vipLevel} />
            </div>
            <p className="text-[11px] text-muted-light">
              Won{' '}
              <span className="text-brand font-mono font-bold">
                {msg.amount} {msg.currency}
              </span>{' '}
              on <span className="text-white">{msg.game}</span>{' '}
              <span className="text-muted">({msg.multiplier}x)</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Normal message
  return (
    <div className="group px-3 py-1 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <div
          className={cn(
            'w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5',
            msg.user.vipLevel >= 4
              ? 'bg-gradient-to-br from-brand to-brand-dark text-background-deep'
              : 'bg-surface-light text-muted-light'
          )}
        >
          {msg.user.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onTipClick(msg.user.name)}
              className={cn(
                'text-[12px] font-semibold truncate hover:text-brand transition-colors',
                msg.user.vipLevel >= 4 ? vipColors[msg.user.vipLevel] : 'text-white'
              )}
            >
              {msg.user.name}
            </button>
            <VipBadge level={msg.user.vipLevel} />
            <span className="text-[10px] text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              {formatTime(msg.timestamp)}
            </span>
          </div>
          <p className="text-[12px] text-muted-light leading-relaxed break-words">
            {msg.content}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Rain modal ─────────────────────────────────────── */
function RainModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [recipients, setRecipients] = useState('10')
  const [currency, setCurrency] = useState('USDT')
  const addMessage = useChatStore((s) => s.addMessage)
  const user = useAuthStore((s) => s.user)

  const handleRain = () => {
    if (!amount || parseFloat(amount) <= 0) return
    const rainMsg: ChatMessage = {
      id: `rain_${Date.now()}`,
      type: 'rain',
      user: { name: user?.username || 'You', vipLevel: user?.vip_level || 0 },
      content: '',
      timestamp: Date.now(),
      rainAmount: parseFloat(amount),
      rainCurrency: currency,
      rainRecipients: parseInt(recipients),
    }
    addMessage(rainMsg)
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[calc(100%-24px)] max-w-sm bg-background-elevated border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent-cyan/10 flex items-center justify-center">
              <CloudRain className="w-4 h-4 text-accent-cyan" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Make it Rain</h3>
              <p className="text-[11px] text-muted">Share with active chatters</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.04] text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-light uppercase tracking-wider mb-1.5">
              Total Amount
            </label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-20 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-accent-cyan/40 transition-colors font-mono"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface-light px-2 py-1 rounded-lg text-[11px] font-bold text-white border border-border"
              >
                <option value="USDT">USDT</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="SOL">SOL</option>
              </select>
            </div>
          </div>

          {/* Recipients */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-light uppercase tracking-wider mb-1.5">
              Number of Recipients
            </label>
            <div className="flex gap-2">
              {['5', '10', '25', '50'].map((n) => (
                <button
                  key={n}
                  onClick={() => setRecipients(n)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all border',
                    recipients === n
                      ? 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30'
                      : 'bg-surface text-muted-light border-border hover:border-border-light'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Per person preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-3 rounded-xl bg-accent-cyan/5 border border-accent-cyan/10">
              <p className="text-[11px] text-muted-light">
                Each recipient gets{' '}
                <span className="text-accent-cyan font-mono font-bold">
                  {(parseFloat(amount) / parseInt(recipients)).toFixed(4)} {currency}
                </span>
              </p>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleRain}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-blue text-white font-semibold text-[13px] disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <CloudRain className="w-4 h-4" />
            Make it Rain!
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Tip modal ──────────────────────────────────────── */
function TipModal({
  recipientName,
  onClose,
}: {
  recipientName: string
  onClose: () => void
}) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USDT')
  const addMessage = useChatStore((s) => s.addMessage)
  const user = useAuthStore((s) => s.user)

  const handleTip = () => {
    if (!amount || parseFloat(amount) <= 0) return
    const tipMsg: ChatMessage = {
      id: `tip_${Date.now()}`,
      type: 'tip',
      user: { name: user?.username || 'You', vipLevel: user?.vip_level || 0 },
      content: '',
      timestamp: Date.now(),
      amount: parseFloat(amount),
      currency,
      recipient: recipientName,
    }
    addMessage(tipMsg)
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[calc(100%-24px)] max-w-sm bg-background-elevated border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent-amber/10 flex items-center justify-center">
              <Gift className="w-4 h-4 text-accent-amber" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Send Tip</h3>
              <p className="text-[11px] text-muted">
                to <span className="text-brand font-semibold">{recipientName}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.04] text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Quick amounts */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-light uppercase tracking-wider mb-1.5">
              Quick Amount
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['0.01', '0.05', '0.10', '0.50'].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={cn(
                    'py-2 rounded-lg text-[12px] font-semibold transition-all border font-mono',
                    amount === v
                      ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/30'
                      : 'bg-surface text-muted-light border-border hover:border-border-light'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-light uppercase tracking-wider mb-1.5">
              Custom Amount
            </label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-20 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-accent-amber/40 transition-colors font-mono"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface-light px-2 py-1 rounded-lg text-[11px] font-bold text-white border border-border"
              >
                <option value="USDT">USDT</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="SOL">SOL</option>
              </select>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleTip}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-amber to-orange-500 text-white font-semibold text-[13px] disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <Gift className="w-4 h-4" />
            Send Tip
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Active Rain Banner ─────────────────────────────── */
function RainBanner() {
  const rain = useChatStore((s) => s.rain)
  if (!rain || !rain.active) return null

  return (
    <div className="mx-2 my-2 p-3 rounded-xl bg-gradient-to-r from-accent-cyan/15 to-accent-blue/15 border border-accent-cyan/25 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CloudRain className="w-5 h-5 text-accent-cyan" />
          <div>
            <p className="text-[12px] font-bold text-accent-cyan">Active Rain!</p>
            <p className="text-[10px] text-muted-light">
              {rain.amount} {rain.currency} — {rain.claimedBy.length}/{rain.totalRecipients} claimed
            </p>
          </div>
        </div>
        <button className="px-3 py-1.5 rounded-lg bg-accent-cyan text-background-deep text-[11px] font-bold hover:brightness-110 transition-all">
          Claim
        </button>
      </div>
    </div>
  )
}

/* ── Main Chat Panel ────────────────────────────────── */
export function ChatPanel() {
  const { messages, isOpen, onlineCount, close, addMessage, isMuted, toggleMute } = useChatStore()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [input, setInput] = useState('')
  const [showRain, setShowRain] = useState(false)
  const [tipTarget, setTipTarget] = useState<string | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isAtBottom])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setIsAtBottom(atBottom)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsAtBottom(true)
  }

  const handleSend = () => {
    if (!input.trim()) return
    const msg: ChatMessage = {
      id: `user_${Date.now()}`,
      type: 'message',
      user: { name: user?.username || 'Guest', vipLevel: user?.vip_level || 0 },
      content: input.trim(),
      timestamp: Date.now(),
    }
    addMessage(msg)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTipClick = (username: string) => {
    setTipTarget(username)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Panel */}
      <aside
        className={cn(
          'fixed lg:relative right-0 top-0 z-50 lg:z-auto',
          'h-screen w-full sm:w-[320px] lg:w-[320px]',
          'bg-background-secondary/95 backdrop-blur-xl lg:bg-background-secondary/80',
          'border-l border-border/60',
          'flex flex-col shrink-0',
          'animate-slide-in-right lg:animate-none'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span className="text-[13px] font-semibold text-white">Chat</span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-bold">
              <Users className="w-3 h-3" />
              {onlineCount.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg hover:bg-white/[0.04] text-muted hover:text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={close}
              className="p-1.5 rounded-lg hover:bg-white/[0.04] text-muted hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Rain Banner */}
        <RainBanner />

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto scrollbar-thin space-y-0.5 py-2"
        >
          {messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} onTipClick={handleTipClick} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll-to-bottom FAB */}
        {!isAtBottom && (
          <div className="absolute bottom-[120px] left-1/2 -translate-x-1/2 z-10">
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-light border border-border text-[11px] font-medium text-white hover:bg-surface-lighter transition-colors shadow-lg"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              New messages
            </button>
          </div>
        )}



        {/* Input */}
        <div className="p-3 border-t border-border/60">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                maxLength={200}
                className="flex-1 px-3 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-brand/40 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2.5 rounded-xl bg-brand text-background-deep hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2">
              <p className="text-[12px] text-muted">
                <a href="/login" className="text-brand font-semibold hover:underline">
                  Log in
                </a>{' '}
                to chat
              </p>
            </div>
          )}
        </div>

        {/* Modals */}
        {showRain && <RainModal onClose={() => setShowRain(false)} />}
        {tipTarget !== null && (
          <TipModal
            recipientName={tipTarget || 'Player'}
            onClose={() => setTipTarget(null)}
          />
        )}
      </aside>
    </>
  )
}
