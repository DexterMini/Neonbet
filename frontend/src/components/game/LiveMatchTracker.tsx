'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, Target, Volume2 } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   LIVE MATCH TRACKER — Elite Broadcast Engine
   ═══════════════════════════════════════════════════════════════════════════
   Features:
   • Player names on pitch (highlighted for ball carrier)
   • Named commentary system ("Silva → Torres!", "FERNANDEZ SCORES!!!")
   • Camera zoom on shots & goals
   • Confetti particle explosions on goals
   • Screen-shake on goals
   • Crowd atmosphere meter
   • Sprint trails on counters
   • TV broadcast-quality overlays
   • 9-phase Markov chain game engine (1s tick rate)
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Types ──────────────────────────────────────────────────────────────────

interface LiveStats {
  possession: [number, number]
  shots: [number, number]
  shotsOnTarget: [number, number]
  corners: [number, number]
  fouls: [number, number]
  yellowCards: [number, number]
  redCards: [number, number]
}

interface LiveEvent {
  minute: number
  type: 'goal' | 'yellow' | 'red' | 'substitution' | 'corner' | 'var'
  team: 'home' | 'away'
  player: string
  detail?: string
}

interface MatchData {
  homeTeam: string
  awayTeam: string
  league: string
  liveMinute?: number
  livePeriod?: string
  score?: [number, number]
  liveStats?: LiveStats
  liveEvents?: LiveEvent[]
}

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  shape: 'circle' | 'rect'
}

// ─── Squad Name Generation ──────────────────────────────────────────────────

const SURNAME_POOLS = [
  ['Martinez', 'Silva', 'Fernandez', 'Torres', 'Morales', 'Santos', 'Vega', 'Cruz', 'Ramos', 'Diaz', 'Reyes'],
  ['Smith', 'Walker', 'Campbell', 'Wright', 'Mitchell', 'Bailey', 'Cooper', 'Phillips', 'Edwards', 'Hughes', 'Foster'],
  ['Müller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Braun', 'Hoffmann', 'Richter', 'Schwarz', 'Wolf'],
  ['Rossi', 'Ferrari', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Conti', 'Esposito'],
  ['Dupont', 'Moreau', 'Laurent', 'Simon', 'Michel', 'André', 'Mercier', 'Blanc', 'Girard', 'Fournier', 'Picard'],
  ['De Jong', 'Van Dijk', 'Bakker', 'Visser', 'Meijer', 'De Groot', 'Bos', 'Vos', 'Peters', 'Mulder', 'De Boer'],
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function getSquad(teamName: string): string[] {
  const h = hashStr(teamName)
  const pool = [...SURNAME_POOLS[h % SURNAME_POOLS.length]]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = ((h * (i + 1) * 7) + i * 13) % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

const JERSEY_NUMS = [1, 2, 3, 4, 5, 6, 8, 10, 7, 9, 11]

// ─── Formations ─────────────────────────────────────────────────────────────

const HOME_FORMATION = [
  { x: 5, y: 32.5 },
  { x: 18, y: 10 }, { x: 16, y: 24 }, { x: 16, y: 41 }, { x: 18, y: 55 },
  { x: 33, y: 16 }, { x: 30, y: 32.5 }, { x: 33, y: 49 },
  { x: 45, y: 12 }, { x: 48, y: 32.5 }, { x: 45, y: 53 },
]
const AWAY_FORMATION = [
  { x: 95, y: 32.5 },
  { x: 82, y: 10 }, { x: 84, y: 24 }, { x: 84, y: 41 }, { x: 82, y: 55 },
  { x: 67, y: 16 }, { x: 70, y: 32.5 }, { x: 67, y: 49 },
  { x: 55, y: 12 }, { x: 52, y: 32.5 }, { x: 55, y: 53 },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function LiveMatchTracker({ match }: { match: MatchData }) {
  const homeSquad = useMemo(() => getSquad(match.homeTeam), [match.homeTeam])
  const awaySquad = useMemo(() => getSquad(match.awayTeam), [match.awayTeam])

  const [players, setPlayers] = useState(() => ({
    home: HOME_FORMATION.map(p => ({ ...p })),
    away: AWAY_FORMATION.map(p => ({ ...p })),
  }))
  const [ballPos, setBallPos] = useState({ x: 50, y: 32.5 })
  const [prevBallPos, setPrevBallPos] = useState({ x: 50, y: 32.5 })
  const [ballHolder, setBallHolder] = useState<{ team: 'home' | 'away'; idx: number }>({ team: 'home', idx: 6 })
  const [momentum, setMomentum] = useState(0)
  const [actionText, setActionText] = useState('')
  const [actionType, setActionType] = useState<'calm' | 'normal' | 'intense' | 'danger'>('normal')
  const [ballTrail, setBallTrail] = useState<{ x: number; y: number }[]>([])
  const [playPhase, setPlayPhase] = useState<'buildup' | 'midfield' | 'attack' | 'transition'>('midfield')
  const [goalFlash, setGoalFlash] = useState<string | null>(null)
  const [eventBanner, setEventBanner] = useState<{ text: string; color: string } | null>(null)
  const [shotLine, setShotLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [cameraZoom, setCameraZoom] = useState<null | 'left' | 'right'>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [atmosphere, setAtmosphere] = useState(30)
  const [screenShake, setScreenShake] = useState(false)

  const tickRef = useRef(0)
  const dataRef = useRef({ homePoss: 50, possBias: 0 })
  const prevBallRef = useRef({ x: 50, y: 32.5 })
  const phaseRef = useRef({
    type: 'midfield' as string, step: 0, maxSteps: 4,
    atkTeam: 'home' as 'home' | 'away', intensity: 0,
  })
  const prevHolderRef = useRef<{ team: 'home' | 'away'; idx: number }>({ team: 'home', idx: 6 })
  const particleIdRef = useRef(0)

  const homePoss = match.liveStats?.possession?.[0] ?? 50
  const awayPoss = match.liveStats?.possession?.[1] ?? 50
  const homeShots = match.liveStats?.shots?.[0] ?? 0
  const awayShots = match.liveStats?.shots?.[1] ?? 0
  dataRef.current = { homePoss, possBias: (homePoss - 50) / 50 }

  // ─── Confetti Spawner ───────────────────────────────────────────────────

  const spawnConfetti = useCallback((cx: number, cy: number, teamColor: string) => {
    const colors = [teamColor, '#ffffff', '#ffd700', teamColor, '#ff69b4', '#00ff88']
    const newP: Particle[] = []
    for (let i = 0; i < 45; i++) {
      const angle = (Math.PI * 2 * i) / 45 + (Math.random() - 0.5) * 0.6
      const speed = 50 + Math.random() * 140
      newP.push({
        id: particleIdRef.current++,
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.7 - 30,
        color: colors[i % colors.length],
        size: 3 + Math.random() * 6,
        shape: Math.random() > 0.5 ? 'circle' : 'rect',
      })
    }
    setParticles(newP)
    setTimeout(() => setParticles([]), 2800)
  }, [])

  // ─── Game Engine ────────────────────────────────────────────────────────

  useEffect(() => {
    const timers: number[] = []
    const delay = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)) }
    const getName = (team: 'home' | 'away', idx: number) =>
      (team === 'home' ? homeSquad : awaySquad)[idx] || 'Player'

    const phaseWeights: Record<string, number[]> = {
      buildup:    [3, 5, 5, 5, 5, 2, 2, 2, 0, 0, 0],
      midfield:   [0, 1, 1, 1, 1, 5, 6, 5, 2, 2, 2],
      attack:     [0, 0, 0, 0, 0, 1, 2, 1, 5, 6, 5],
      transition: [0, 0, 1, 1, 0, 2, 3, 2, 4, 5, 4],
      shot:       [0, 0, 0, 0, 0, 0, 0, 0, 3, 5, 3],
      corner:     [0, 0, 0, 0, 0, 0, 1, 1, 4, 5, 4],
      freekick:   [0, 0, 0, 0, 0, 0, 2, 3, 2, 4, 2],
      save:       [5, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
      goal:       [0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0],
    }

    const phaseTransitions: Record<string, Record<string, number>> = {
      buildup:    { buildup: 0.15, midfield: 0.45, attack: 0.12, transition: 0.22, corner: 0.03, freekick: 0.03 },
      midfield:   { buildup: 0.06, midfield: 0.22, attack: 0.48, transition: 0.12, corner: 0.06, freekick: 0.06 },
      attack:     { buildup: 0.04, midfield: 0.12, attack: 0.20, transition: 0.10, shot: 0.38, corner: 0.11, freekick: 0.05 },
      transition: { buildup: 0.05, midfield: 0.15, attack: 0.65, transition: 0.05, shot: 0.05, corner: 0.03, freekick: 0.02 },
      shot:       { save: 0.46, goal: 0.12, corner: 0.30, midfield: 0.12 },
      corner:     { attack: 0.30, shot: 0.20, midfield: 0.26, buildup: 0.14, transition: 0.10 },
      freekick:   { shot: 0.30, attack: 0.25, midfield: 0.25, corner: 0.10, buildup: 0.10 },
      save:       { buildup: 0.30, midfield: 0.40, transition: 0.20, corner: 0.10 },
      goal:       { midfield: 0.70, buildup: 0.30 },
    }

    const interval = setInterval(() => {
      tickRef.current++
      const t = tickRef.current
      const ph = phaseRef.current
      const { homePoss: hp, possBias: pb } = dataRef.current

      ph.step++
      // Phase transitions
      if (ph.step >= ph.maxSteps) {
        const trans = phaseTransitions[ph.type] || phaseTransitions.midfield
        let roll = Math.random(), cumul = 0, nextType = 'midfield'
        for (const [phase, prob] of Object.entries(trans)) {
          cumul += prob
          if (roll <= cumul) { nextType = phase; break }
        }
        ph.type = nextType
        ph.step = 0
        if (nextType === 'shot') ph.maxSteps = 2
        else if (nextType === 'save') ph.maxSteps = 2
        else if (nextType === 'goal') ph.maxSteps = 5
        else if (nextType === 'corner' || nextType === 'freekick') ph.maxSteps = 3
        else if (nextType === 'transition') { ph.maxSteps = 2; ph.atkTeam = ph.atkTeam === 'home' ? 'away' : 'home' }
        else ph.maxSteps = 2 + Math.floor(Math.random() * 3)
        if (['midfield', 'buildup'].includes(nextType) && Math.random() < 0.25) {
          ph.atkTeam = Math.random() < hp / 100 ? 'home' : 'away'
        }
      }

      // Intensity
      const intMap: Record<string, number> = { attack: 0.3, transition: 0.25, shot: 1, goal: 1, save: 0.8, corner: 0.25, freekick: 0.15 }
      if (intMap[ph.type] !== undefined) ph.intensity = Math.min(1, ph.intensity + intMap[ph.type])
      else ph.intensity = Math.max(0, ph.intensity - 0.15)

      const atk = ph.atkTeam
      const def: 'home' | 'away' = atk === 'home' ? 'away' : 'home'
      const atkI = ph.intensity
      const homeShift = pb * 10
      const awayShift = pb * 10
      const phaseShiftX = (['attack', 'shot', 'corner', 'transition'].includes(ph.type))
        ? (atk === 'home' ? atkI * 8 : -atkI * 8)
        : ph.type === 'buildup' ? (atk === 'home' ? -2 : 2) : 0

      // Move players
      const home = HOME_FORMATION.map((base, i) => {
        const atkPush = atk === 'home'
          ? atkI * (i >= 8 ? 15 : i >= 5 ? 7 : i >= 1 ? 3.5 : 0)
          : -atkI * (i >= 8 ? 2 : i >= 5 ? 4 : i >= 1 ? 6 : 0)
        return {
          x: Math.max(2, Math.min(98, base.x + homeShift + phaseShiftX + atkPush + Math.sin(t * 0.3 + i * 1.7) * 3 + (Math.random() - 0.5) * 1.5)),
          y: Math.max(3, Math.min(62, base.y + Math.cos(t * 0.4 + i * 2.1) * 2.5 + (Math.random() - 0.5) * 1.5)),
        }
      })
      const away = AWAY_FORMATION.map((base, i) => {
        const atkPush = atk === 'away'
          ? -atkI * (i >= 8 ? 15 : i >= 5 ? 7 : i >= 1 ? 3.5 : 0)
          : atkI * (i >= 8 ? 2 : i >= 5 ? 4 : i >= 1 ? 6 : 0)
        return {
          x: Math.max(2, Math.min(98, base.x - awayShift + phaseShiftX + atkPush + Math.sin(t * 0.35 + i * 1.9) * 3 + (Math.random() - 0.5) * 1.5)),
          y: Math.max(3, Math.min(62, base.y + Math.cos(t * 0.45 + i * 2.3) * 2.5 + (Math.random() - 0.5) * 1.5)),
        }
      })

      // Pick ball holder
      const holdTeam: 'home' | 'away' = ['save'].includes(ph.type) ? def
        : ['goal', 'shot', 'attack', 'corner', 'freekick', 'transition'].includes(ph.type) ? atk
        : Math.random() < (hp / 100) ? 'home' : 'away'
      const weights = phaseWeights[ph.type] || phaseWeights.midfield
      const totalW = weights.reduce((a, b) => a + b, 0)
      let r = Math.random() * totalW, idx = 0
      for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { idx = i; break } }

      const holderPlayers = holdTeam === 'home' ? home : away
      const holder = holderPlayers[idx]
      const prev = prevBallRef.current
      prevBallRef.current = { x: holder.x, y: holder.y }

      const displayPhase = (['shot', 'corner', 'freekick', 'goal'].includes(ph.type)) ? 'attack' as const
        : (['save'].includes(ph.type)) ? 'buildup' as const
        : (ph.type as 'buildup' | 'midfield' | 'attack' | 'transition')

      let aType: 'calm' | 'normal' | 'intense' | 'danger' = 'normal'
      if (['shot', 'goal'].includes(ph.type)) aType = 'danger'
      else if (['attack', 'corner', 'freekick', 'transition', 'save'].includes(ph.type)) aType = 'intense'
      else if (ph.type === 'buildup') aType = 'calm'

      // Atmosphere
      const atmoTarget = ph.type === 'goal' ? 100 : ph.type === 'shot' ? 92
        : ph.type === 'save' ? 88 : ph.type === 'attack' ? 65
        : ph.type === 'corner' ? 60 : ph.type === 'freekick' ? 55
        : ph.type === 'transition' ? 50 : ph.type === 'midfield' ? 35 : 20
      setAtmosphere(a => a + (atmoTarget - a) * 0.3)

      const prevH = prevHolderRef.current
      prevHolderRef.current = { team: holdTeam, idx }

      // ─── Commentary with REAL player names ────────────────────────────
      const squad = holdTeam === 'home' ? homeSquad : awaySquad
      const hn = squad[idx] || 'Player'
      const prevSameTeam = prevH.team === holdTeam
      const pn = prevSameTeam
        ? (squad[prevH.idx] || 'Player')
        : ((prevH.team === 'home' ? homeSquad : awaySquad)[prevH.idx] || 'Player')
      const ti = (idx + 2 + Math.floor(Math.random() * 5)) % 11
      const tn = squad[ti] || 'Player'
      const gkName = (def === 'home' ? homeSquad : awaySquad)[0] || 'Keeper'

      const calmPool = [
        `${hn} plays it back to ${tn}...`,
        `Patient possession from ${hn}`,
        `${hn} recycling the ball deep...`,
        prevSameTeam ? `${pn} → ${hn}` : `${hn} picks up the loose ball`,
        `${hn} spreading the play wide to ${tn}`,
      ]
      const normalPool = [
        prevSameTeam ? `${pn} finds ${hn} in space!` : `${hn} wins the ball back!`,
        `Quick exchange: ${hn} → ${tn}!`,
        `${hn} drives forward past the marker!`,
        `${hn} pressing high!`,
        `${hn} switches play to ${tn}`,
        `${hn} controls and plays it forward`,
      ]
      const intensePool = [
        `${hn} bursts into the final third!`,
        `Dangerous run by ${hn}!`,
        `${hn} whips in a cross to ${tn}!`,
        prevSameTeam ? `Counter! ${pn} releases ${hn}!` : `${hn} breaks at pace!`,
        `Through ball! ${hn} finds ${tn}!`,
        `${hn} cuts inside from the wing!`,
      ]
      const dangerPool = [
        `SHOT! ${hn} lets fly! 💥`,
        `${hn} FIRES from the edge!`,
        `ONE-ON-ONE! ${hn}! 🔥`,
        prevSameTeam ? `${pn} cuts back, ${hn} SHOOTS!` : `${hn} with a powerful strike!`,
        `Header by ${hn}!`,
      ]
      const savePool = [
        `SAVE! ${gkName} denies ${hn}!`,
        `${gkName} with an incredible stop! 🧤`,
        `${gkName} pushes it over the bar!`,
        `Outstanding reflexes from ${gkName}!`,
      ]
      const goalPool = [
        `⚽ GOOOAL!!! ${hn} SCORES!!!`,
        `⚽ ${hn} BURIES IT!!!`,
        `⚽ WHAT A FINISH by ${hn}!!!`,
        `⚽ ${hn}!!! UNSTOPPABLE!!!`,
      ]
      const cornerPool = [
        `Corner kick taken by ${hn}...`,
        `${hn} whips in the corner! ${tn} running in!`,
      ]
      const freekickPool = [
        `Free kick. ${hn} over the ball...`,
        `${hn} sizing up the free kick...`,
      ]

      // ─── Dramatic Event Triggers ──────────────────────────────────────

      // Shot → camera zoom + shot arrow
      if (ph.type === 'shot' && ph.step === 0) {
        const goalX = atk === 'home' ? 97 : 3
        const goalY = 32.5 + (Math.random() - 0.5) * 8
        setShotLine({ x1: holder.x, y1: holder.y, x2: goalX, y2: goalY })
        setCameraZoom(atk === 'home' ? 'right' : 'left')
        delay(() => setShotLine(null), 1000)
        delay(() => setCameraZoom(null), 2500)
      }

      // Goal → confetti + flash + banner + shake + camera
      if (ph.type === 'goal' && ph.step === 0) {
        const c = atk === 'home' ? '#00e87b' : '#3b82f6'
        const txt = goalPool[Math.floor(Math.random() * goalPool.length)]
        setGoalFlash(c)
        setEventBanner({ text: txt, color: c })
        setScreenShake(true)
        setCameraZoom(atk === 'home' ? 'right' : 'left')
        spawnConfetti(atk === 'home' ? 82 : 18, 50, c)
        delay(() => setGoalFlash(null), 2200)
        delay(() => setEventBanner(null), 4500)
        delay(() => setScreenShake(false), 800)
        delay(() => setCameraZoom(null), 3800)
      }

      // Save banner
      if (ph.type === 'save' && ph.step === 0) {
        const txt = savePool[Math.floor(Math.random() * savePool.length)]
        setEventBanner({ text: txt, color: '#f59e0b' })
        delay(() => setEventBanner(null), 2200)
      }

      // ─── State Batching ───────────────────────────────────────────────

      setPlayers({ home, away })
      setBallHolder({ team: holdTeam, idx })
      setPrevBallPos({ x: prev.x, y: prev.y })
      setBallPos({ x: holder.x, y: holder.y })
      setBallTrail(tr => [...tr.slice(-5), { x: holder.x, y: holder.y }])
      setMomentum(prevM => prevM + ((pb * 80 + atkI * 25 * (atk === 'home' ? 1 : -1) + (Math.random() - 0.5) * 15) - prevM) * 0.15)
      setPlayPhase(displayPhase)
      setActionType(aType)

      // Commentary text selection
      if (ph.type === 'goal' && ph.step === 0) {
        setActionText(goalPool[Math.floor(Math.random() * goalPool.length)])
      } else if (ph.type === 'save' && ph.step === 0) {
        setActionText(savePool[Math.floor(Math.random() * savePool.length)])
      } else if (ph.type === 'corner' && ph.step === 0) {
        setActionText(cornerPool[Math.floor(Math.random() * cornerPool.length)])
      } else if (ph.type === 'freekick' && ph.step === 0) {
        setActionText(freekickPool[Math.floor(Math.random() * freekickPool.length)])
      } else if (t % 2 === 0 || ph.type === 'shot') {
        const pool = ph.type === 'shot' ? dangerPool
          : aType === 'calm' ? calmPool
          : aType === 'intense' ? intensePool
          : normalPool
        setActionText(pool[Math.floor(Math.random() * pool.length)])
      } else if (t % 3 === 2 && !['shot', 'goal', 'save'].includes(ph.type)) {
        setActionText('')
      }
    }, 1000) // ← Faster tick for fluid feel

    return () => { clearInterval(interval); timers.forEach(t => clearTimeout(t)) }
  }, [homeSquad, awaySquad, spawnConfetti])

  // ─── Derived ────────────────────────────────────────────────────────────

  const lastEvent = match.liveEvents?.[match.liveEvents.length - 1]
  const isDangerHome = ballPos.x > 72 || playPhase === 'attack'
  const isDangerAway = ballPos.x < 28
  const holderName = (ballHolder.team === 'home' ? homeSquad : awaySquad)[ballHolder.idx] || ''

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className={`w-full h-full relative bg-[#0a1a0d] overflow-hidden select-none ${screenShake ? 'screen-shake' : ''}`}>
      {/* ── Styles ──────────────────────────────────────────────────────── */}
      <style>{`
        .player { transition: cx 0.85s cubic-bezier(0.4, 0, 0.2, 1), cy 0.85s cubic-bezier(0.4, 0, 0.2, 1); }
        .player-label { transition: x 0.85s cubic-bezier(0.4, 0, 0.2, 1), y 0.85s cubic-bezier(0.4, 0, 0.2, 1); }
        .player-shadow { transition: cx 0.85s cubic-bezier(0.4, 0, 0.2, 1), cy 0.85s cubic-bezier(0.4, 0, 0.2, 1); }
        .ball { transition: cx 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94), cy 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        .holder-ring { transition: cx 0.45s ease-out, cy 0.45s ease-out; }
        .spotlight { transition: cx 0.7s ease-out, cy 0.7s ease-out; }
        .pass-line { transition: x1 0.15s, y1 0.15s, x2 0.55s ease-out, y2 0.55s ease-out; }
        .trail { transition: cx 0.3s ease-out, cy 0.3s ease-out; }
        @keyframes holderPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.9; }
        }
        @keyframes dangerPulse {
          0%, 100% { opacity: 0.04; }
          50% { opacity: 0.25; }
        }
        @keyframes ringExpand {
          0% { opacity: 0.7; }
          100% { opacity: 0; }
        }
        @keyframes shotFlash {
          0% { opacity: 0; }
          12% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes confettiFly {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
          55% { opacity: 0.85; }
          100% { transform: translate(var(--fx), var(--fy)) scale(0.15) rotate(900deg); opacity: 0; }
        }
        @keyframes screenShakeAnim {
          0%, 100% { transform: translate(0, 0); }
          8% { transform: translate(-5px, 4px); }
          16% { transform: translate(5px, -4px); }
          24% { transform: translate(-4px, -5px); }
          32% { transform: translate(4px, 5px); }
          44% { transform: translate(-3px, -2px); }
          56% { transform: translate(2px, 2px); }
          68% { transform: translate(-1px, 1px); }
        }
        @keyframes atmoGlow {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .holder-pulse { animation: holderPulse 0.7s ease-in-out infinite; }
        .danger-zone { animation: dangerPulse 0.7s ease-in-out infinite; }
        .ring-expand { animation: ringExpand 1.3s ease-out infinite; }
        .screen-shake { animation: screenShakeAnim 0.7s ease-out; }
        .confetti-particle { animation: confettiFly 2.2s cubic-bezier(0.2, 0.8, 0.3, 1) forwards; position: absolute; pointer-events: none; }
        .shot-flash { animation: shotFlash 0.5s ease-out; }
        .atmo-glow { animation: atmoGlow 1.5s ease-in-out infinite; }
      `}</style>

      {/* ── SVG Pitch ───────────────────────────────────────────────────── */}
      <svg
        viewBox="0 0 100 65"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        style={{
          transform: cameraZoom === 'right' ? 'scale(1.8)' : cameraZoom === 'left' ? 'scale(1.8)' : 'scale(1)',
          transformOrigin: cameraZoom === 'right' ? '82% 50%' : cameraZoom === 'left' ? '18% 50%' : '50% 50%',
          transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1), transform-origin 0.5s ease',
        }}
      >
        <defs>
          <radialGradient id="mtBallGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.8" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mtSpotlight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.09" />
            <stop offset="50%" stopColor="white" stopOpacity="0.03" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mtDangerR" cx="100%" cy="50%" r="80%">
            <stop offset="0%" stopColor="#ff3333" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ff3333" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mtDangerL" cx="0%" cy="50%" r="80%">
            <stop offset="0%" stopColor="#ff3333" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ff3333" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mtHome" cx="35%" cy="25%" r="65%">
            <stop offset="0%" stopColor="#4fffb0" />
            <stop offset="100%" stopColor="#00a854" />
          </radialGradient>
          <radialGradient id="mtAway" cx="35%" cy="25%" r="65%">
            <stop offset="0%" stopColor="#82c4ff" />
            <stop offset="100%" stopColor="#1a5fd9" />
          </radialGradient>
          <radialGradient id="mtGK" cx="35%" cy="25%" r="65%">
            <stop offset="0%" stopColor="#ffe066" />
            <stop offset="100%" stopColor="#cc8800" />
          </radialGradient>
          <linearGradient id="mtPitch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d6832" />
            <stop offset="50%" stopColor="#185028" />
            <stop offset="100%" stopColor="#1d6832" />
          </linearGradient>
        </defs>

        {/* Pitch base */}
        <rect x="0" y="0" width="100" height="65" fill="url(#mtPitch)" />
        {/* Mow stripes */}
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={`mow${i}`} x={i * 10} y="0" width="10" height="65"
            fill={i % 2 === 0 ? 'rgba(255,255,255,0.022)' : 'transparent'} />
        ))}
        {/* Stadium shadow edges */}
        <rect x="0" y="0" width="100" height="4" fill="rgba(0,0,0,0.18)" />
        <rect x="0" y="61" width="100" height="4" fill="rgba(0,0,0,0.18)" />

        {/* ── Field Markings ──────────────────────────────────────────── */}
        <rect x="3" y="3" width="94" height="59" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.3" />
        <line x1="50" y1="3" x2="50" y2="62" stroke="rgba(255,255,255,0.28)" strokeWidth="0.3" />
        <circle cx="50" cy="32.5" r="8" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.3" />
        <circle cx="50" cy="32.5" r="0.6" fill="rgba(255,255,255,0.4)" />
        {/* Penalty areas */}
        <rect x="3" y="14" width="14" height="37" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.3" />
        <rect x="83" y="14" width="14" height="37" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.3" />
        <rect x="3" y="22" width="5" height="21" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.3" />
        <rect x="92" y="22" width="5" height="21" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.3" />
        {/* Penalty arcs */}
        <path d="M 14 24 A 8 8 0 0 1 14 41" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.25" />
        <path d="M 86 24 A 8 8 0 0 0 86 41" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.25" />
        {/* Corner arcs */}
        <path d="M 3 5 A 2 2 0 0 1 5 3" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.25" />
        <path d="M 95 3 A 2 2 0 0 1 97 5" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.25" />
        <path d="M 5 62 A 2 2 0 0 1 3 60" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.25" />
        <path d="M 97 60 A 2 2 0 0 1 95 62" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.25" />
        {/* Penalty spots */}
        <circle cx="13" cy="32.5" r="0.4" fill="rgba(255,255,255,0.3)" />
        <circle cx="87" cy="32.5" r="0.4" fill="rgba(255,255,255,0.3)" />
        {/* Goals */}
        <rect x="0.4" y="25.5" width="2.6" height="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.35" rx="0.3" />
        <rect x="97" y="25.5" width="2.6" height="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.35" rx="0.3" />
        {/* Goal nets */}
        {[27, 29, 31, 33, 35, 37].map(y => (
          <g key={`net${y}`}>
            <line x1="0.4" y1={y} x2="3" y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.12" />
            <line x1="97" y1={y} x2="99.6" y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.12" />
          </g>
        ))}
        {/* Corner flags */}
        {[[3, 3], [97, 3], [3, 62], [97, 62]].map(([fx, fy], i) => (
          <g key={`flag${i}`}>
            <line x1={fx} y1={fy} x2={fx} y2={fy - 2} stroke="rgba(255,200,0,0.45)" strokeWidth="0.15" />
            <polygon points={`${fx},${fy - 2} ${fx + 0.9},${fy - 1.5} ${fx},${fy - 1}`} fill="rgba(255,200,0,0.35)" />
          </g>
        ))}

        {/* ── Dynamic Elements ────────────────────────────────────────── */}

        {/* Spotlight */}
        <circle className="spotlight ball" cx={ballPos.x} cy={ballPos.y} r="26" fill="url(#mtSpotlight)" />

        {/* Danger zones */}
        {isDangerHome && <rect className="danger-zone" x="74" y="5" width="26" height="55" fill="url(#mtDangerR)" rx="2" />}
        {isDangerAway && <rect className="danger-zone" x="0" y="5" width="26" height="55" fill="url(#mtDangerL)" rx="2" />}

        {/* Pass trail */}
        <line className="pass-line"
          x1={prevBallPos.x} y1={prevBallPos.y} x2={ballPos.x} y2={ballPos.y}
          stroke="rgba(255,255,255,0.3)" strokeWidth="0.2" strokeDasharray="0.8 0.4" strokeLinecap="round" opacity="0.4" />

        {/* Ball ghost trail */}
        {ballTrail.slice(0, -1).map((pos, i) => (
          <circle key={`tr${i}`} cx={pos.x} cy={pos.y} r={0.35}
            fill="white" opacity={0.03 * (i + 1)} className="trail" />
        ))}

        {/* Holder rings */}
        <circle className="ring-expand holder-ring" cx={ballPos.x} cy={ballPos.y} r="4"
          fill="none" stroke={ballHolder.team === 'home' ? 'rgba(0,232,123,0.3)' : 'rgba(59,130,246,0.3)'}
          strokeWidth="0.15" />
        <circle className="holder-pulse holder-ring" cx={ballPos.x} cy={ballPos.y} r="2.5"
          fill="none" stroke={ballHolder.team === 'home' ? 'rgba(0,232,123,0.7)' : 'rgba(59,130,246,0.7)'}
          strokeWidth="0.3" />

        {/* Shot arrow */}
        {shotLine && (
          <>
            <line x1={shotLine.x1} y1={shotLine.y1} x2={shotLine.x2} y2={shotLine.y2}
              stroke="rgba(255,55,55,0.9)" strokeWidth="0.5" strokeDasharray="0.7,0.3"
              className="shot-flash" />
            <circle cx={shotLine.x2} cy={shotLine.y2} r="3.5" fill="rgba(255,55,55,0.12)"
              stroke="rgba(255,55,55,0.7)" strokeWidth="0.25" className="shot-flash" />
          </>
        )}

        {/* ── HOME Players ────────────────────────────────────────────── */}
        {players.home.map((p, i) => {
          const isH = ballHolder.team === 'home' && ballHolder.idx === i
          return (
            <g key={`h${i}`}>
              <ellipse className="player-shadow" cx={p.x} cy={p.y + 1.6} rx="1.5" ry="0.4" fill="rgba(0,0,0,0.35)" />
              <circle className="player" cx={p.x} cy={p.y} r={isH ? 2.1 : 1.75}
                fill={i === 0 ? 'url(#mtGK)' : 'url(#mtHome)'}
                stroke={isH ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.4)'}
                strokeWidth={isH ? 0.45 : 0.3} />
              <circle className="player" cx={p.x - 0.35} cy={p.y - 0.5} r="0.5"
                fill="rgba(255,255,255,0.2)" />
              <text className="player" x={p.x} y={p.y + 0.55} textAnchor="middle"
                fontSize="1.15" fill="rgba(0,0,0,0.85)" fontWeight="bold" fontFamily="system-ui">
                {JERSEY_NUMS[i]}
              </text>
              <text className="player-label" x={p.x} y={p.y + 4} textAnchor="middle"
                fontSize={isH ? '1.55' : '1.1'}
                fill={isH ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)'}
                fontWeight={isH ? 'bold' : 'normal'}
                fontFamily="system-ui">
                {homeSquad[i]?.toUpperCase() || ''}
              </text>
            </g>
          )
        })}

        {/* ── AWAY Players ────────────────────────────────────────────── */}
        {players.away.map((p, i) => {
          const isH = ballHolder.team === 'away' && ballHolder.idx === i
          return (
            <g key={`a${i}`}>
              <ellipse className="player-shadow" cx={p.x} cy={p.y + 1.6} rx="1.5" ry="0.4" fill="rgba(0,0,0,0.35)" />
              <circle className="player" cx={p.x} cy={p.y} r={isH ? 2.1 : 1.75}
                fill={i === 0 ? 'url(#mtGK)' : 'url(#mtAway)'}
                stroke={isH ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.4)'}
                strokeWidth={isH ? 0.45 : 0.3} />
              <circle className="player" cx={p.x - 0.35} cy={p.y - 0.5} r="0.5"
                fill="rgba(255,255,255,0.16)" />
              <text className="player" x={p.x} y={p.y + 0.55} textAnchor="middle"
                fontSize="1.15" fill="rgba(0,0,0,0.85)" fontWeight="bold" fontFamily="system-ui">
                {JERSEY_NUMS[i]}
              </text>
              <text className="player-label" x={p.x} y={p.y + 4} textAnchor="middle"
                fontSize={isH ? '1.55' : '1.1'}
                fill={isH ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)'}
                fontWeight={isH ? 'bold' : 'normal'}
                fontFamily="system-ui">
                {awaySquad[i]?.toUpperCase() || ''}
              </text>
            </g>
          )
        })}

        {/* ── Ball ────────────────────────────────────────────────────── */}
        <circle className="ball" cx={ballPos.x} cy={ballPos.y}
          r={actionType === 'danger' ? 6 : actionType === 'intense' ? 4.5 : 3.5}
          fill="url(#mtBallGlow)" opacity="0.45" />
        <ellipse className="ball" cx={ballPos.x} cy={ballPos.y + 1.2} rx="0.95" ry="0.24" fill="rgba(0,0,0,0.4)" />
        <circle className="ball" cx={ballPos.x} cy={ballPos.y} r="0.95"
          fill="white" stroke="rgba(50,50,50,0.5)" strokeWidth="0.15" />
        <circle className="ball" cx={ballPos.x} cy={ballPos.y} r="0.32"
          fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.1" />
      </svg>

      {/* ── HTML Overlays ───────────────────────────────────────────────── */}

      {/* Confetti particles */}
      {particles.map(p => (
        <div key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            backgroundColor: p.color,
            '--fx': `${p.vx}px`,
            '--fy': `${p.vy}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* Goal celebration flash */}
      {goalFlash && (
        <div className="absolute inset-0 z-20 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${goalFlash}45 0%, transparent 65%)`,
            animation: 'shotFlash 1.8s ease-out',
          }}
        />
      )}

      {/* Event banner (animated) */}
      <AnimatePresence>
        {eventBanner && (
          <motion.div
            key={eventBanner.text}
            initial={{ opacity: 0, scale: 0.4, y: 25 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -15 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200 }}
            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
          >
            <div className="px-8 py-4 rounded-2xl backdrop-blur-xl text-xl sm:text-2xl font-black tracking-wider border-2 shadow-2xl"
              style={{
                color: eventBanner.color,
                background: `linear-gradient(135deg, ${eventBanner.color}22 0%, ${eventBanner.color}08 100%)`,
                borderColor: `${eventBanner.color}55`,
                textShadow: `0 0 30px ${eventBanner.color}80, 0 2px 10px rgba(0,0,0,0.6)`,
                boxShadow: `0 0 50px ${eventBanner.color}25, inset 0 0 30px ${eventBanner.color}08`,
              }}>
              {eventBanner.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Atmosphere Meter ─────────────────────────────────────────── */}
      <div className="absolute right-1.5 top-[28%] bottom-[28%] w-[6px] z-10 flex flex-col-reverse rounded-full overflow-hidden bg-white/[0.06] border border-white/[0.06]">
        <div
          className={`transition-all duration-700 rounded-full ${atmosphere > 80 ? 'atmo-glow' : ''}`}
          style={{
            height: `${Math.min(100, atmosphere)}%`,
            background: atmosphere > 80 ? 'linear-gradient(to top, #ef4444, #ff6b6b)'
              : atmosphere > 55 ? 'linear-gradient(to top, #f59e0b, #fbbf24)'
              : 'linear-gradient(to top, #22c55e, #4ade80)',
          }}
        />
      </div>
      <div className="absolute right-0.5 top-[24%] z-10">
        <Volume2 size={7} className="text-white/20" />
      </div>

      {/* ── TV Broadcast Scoreboard ──────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-10">
        <div className="flex items-center justify-between mx-2 mt-1.5 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/[0.08] shadow-lg shadow-black/30">
          {/* Home */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-3.5 h-3.5 rounded-full bg-[#00e87b] shrink-0 border border-white/20 shadow-sm shadow-green-500/30" />
            <span className="text-[10px] font-bold text-white truncate">{match.homeTeam}</span>
          </div>
          {/* Score + Time */}
          <div className="flex items-center gap-2.5 px-4 shrink-0">
            <span className="text-lg font-black text-white tabular-nums min-w-[16px] text-center">{match.score?.[0] ?? 0}</span>
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/25 border border-red-500/20">
                <Radio size={5} className="text-red-500 animate-pulse" />
                <span className="text-[8px] font-black text-red-400 tabular-nums">{match.liveMinute}&apos;</span>
              </div>
              <span className="text-[6px] text-white/30 font-semibold uppercase">{match.livePeriod || 'LIVE'}</span>
            </div>
            <span className="text-lg font-black text-white tabular-nums min-w-[16px] text-center">{match.score?.[1] ?? 0}</span>
          </div>
          {/* Away */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-[10px] font-bold text-white truncate">{match.awayTeam}</span>
            <div className="w-3.5 h-3.5 rounded-full bg-[#3b82f6] shrink-0 border border-white/20 shadow-sm shadow-blue-500/30" />
          </div>
        </div>
        {/* Phase indicator sub-bar */}
        <div className="flex items-center justify-between mx-2 mt-0.5 px-3 py-0.5 rounded-md bg-black/40 backdrop-blur-sm">
          <span className="text-[7px] text-white/25 font-medium truncate">{match.league}</span>
          <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
            playPhase === 'attack' ? 'text-red-400/90 bg-red-500/15' :
            playPhase === 'transition' ? 'text-amber-400/90 bg-amber-500/15' :
            playPhase === 'buildup' ? 'text-green-400/70 bg-green-500/10' :
            'text-white/30 bg-white/5'
          }`}>
            {playPhase === 'attack' ? '⚡ ATTACK' : playPhase === 'transition' ? '↻ TRANSITION' : playPhase === 'buildup' ? '◈ BUILD-UP' : '◉ POSSESSION'}
          </span>
        </div>
      </div>

      {/* ── Commentary Bar ───────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {actionText && (
          <motion.div
            key={actionText}
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="absolute top-[62px] left-1/2 -translate-x-1/2 z-10 max-w-[92%]"
          >
            <span className={`text-[10px] font-semibold px-3 py-1.5 rounded-full backdrop-blur-md border inline-block whitespace-nowrap shadow-lg ${
              actionType === 'danger' ? 'text-red-400 bg-red-500/15 border-red-500/30 shadow-red-900/30' :
              actionType === 'intense' ? 'text-amber-300 bg-amber-500/10 border-amber-500/20 shadow-amber-900/20' :
              actionType === 'normal' ? 'text-white/65 bg-white/[0.06] border-white/10' :
              'text-white/40 bg-black/40 border-white/[0.06]'
            }`}>
              {actionText}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last event badge */}
      {lastEvent && (
        <div className="absolute top-[62px] right-3 z-10">
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded backdrop-blur-md text-[8px] font-bold border ${
            lastEvent.type === 'goal' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
            lastEvent.type === 'yellow' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
            lastEvent.type === 'red' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
            'bg-white/10 text-white/50 border-white/10'
          }`}>
            <span>{lastEvent.minute}&apos;</span>
            <span>{lastEvent.type === 'goal' ? '⚽' : lastEvent.type === 'yellow' ? '🟨' : lastEvent.type === 'red' ? '🟥' : '📋'}</span>
          </div>
        </div>
      )}

      {/* ── Ball Carrier Indicator ───────────────────────────────────── */}
      <div className="absolute bottom-[48px] left-1/2 -translate-x-1/2 z-10">
        <motion.span
          key={holderName}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full backdrop-blur-md border shadow-sm ${
            ballHolder.team === 'home'
              ? 'text-[#00e87b]/90 bg-[#00e87b]/10 border-[#00e87b]/25 shadow-green-900/20'
              : 'text-[#3b82f6]/90 bg-[#3b82f6]/10 border-[#3b82f6]/25 shadow-blue-900/20'
          }`}
        >
          {JERSEY_NUMS[ballHolder.idx]} {holderName}
        </motion.span>
      </div>

      {/* ── Bottom Stats Bar ─────────────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent z-10">
        <div className="flex items-center gap-3 px-3 py-1.5">
          <div className="flex items-center gap-1 flex-1">
            <span className="text-[8px] text-[#00e87b]/70 font-bold tabular-nums">{homePoss}%</span>
            <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full bg-[#00e87b]/50 rounded-full transition-all duration-500" style={{ width: `${homePoss}%` }} />
            </div>
          </div>
          <span className="text-[7px] text-white/25 font-bold shrink-0">POSS</span>
          <div className="flex items-center gap-1 flex-1">
            <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full bg-[#3b82f6]/50 rounded-full transition-all duration-500 ml-auto" style={{ width: `${awayPoss}%` }} />
            </div>
            <span className="text-[8px] text-[#3b82f6]/70 font-bold tabular-nums">{awayPoss}%</span>
          </div>
          <div className="w-px h-3.5 bg-white/10" />
          <div className="flex items-center gap-1">
            <Target size={8} className="text-white/25" />
            <span className="text-[8px] text-white/35 font-bold tabular-nums">{homeShots}-{awayShots}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
