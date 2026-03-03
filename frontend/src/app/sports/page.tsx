'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronDown, ChevronUp, Star, TrendingUp, Zap, Clock,
  Trophy, BarChart3, ArrowUpRight, ArrowDownRight, Filter, X,
  Flame, Shield, Target, Eye, ChevronRight, Activity, Globe2,
  Sparkles, Percent
} from 'lucide-react'
import { MobileNav } from '@/components/MobileNav'

/* ──────────────────── Types ──────────────────── */

interface BookmakerOdds {
  bookmaker: string
  home: number
  draw?: number
  away: number
}

interface Market {
  matchWinner: { home: number; draw?: number; away: number }
  overUnder?: { over: number; under: number; line: number }
  bothTeamsScore?: { yes: number; no: number }
  handicap?: { home: number; away: number; line: string }
}

interface MatchEvent {
  id: string
  sport: string
  league: string
  homeTeam: string
  awayTeam: string
  startTime: Date
  isLive: boolean
  homeScore?: number
  awayScore?: number
  minute?: number
  period?: string
  markets: Market
  bookmakers: BookmakerOdds[]
  featured?: boolean
  boosted?: boolean
}

interface BetSlipItem {
  matchId: string
  match: string
  selection: string
  odds: number
  market: string
}

/* ──────────────────── Constants ──────────────────── */

const SPORT_ICONS: Record<string, string> = {
  football: '⚽', basketball: '🏀', tennis: '🎾', ufc: '🥊', esports: '🎮',
  baseball: '⚾', hockey: '🏒', cricket: '🏏', volleyball: '🏐', rugby: '🏉',
  f1: '🏎️', boxing: '🥊', golf: '⛳', handball: '🤾', tableTennis: '🏓',
  darts: '🎯', americanFootball: '🏈', cycling: '🚴', swimming: '🏊',
  snooker: '🎱'
}

const SPORT_LABELS: Record<string, string> = {
  football: 'Football', basketball: 'Basketball', tennis: 'Tennis',
  ufc: 'UFC / MMA', esports: 'Esports', baseball: 'Baseball',
  hockey: 'Ice Hockey', cricket: 'Cricket', volleyball: 'Volleyball',
  rugby: 'Rugby', f1: 'Formula 1', boxing: 'Boxing', golf: 'Golf',
  handball: 'Handball', tableTennis: 'Table Tennis', darts: 'Darts',
  americanFootball: 'American Football', cycling: 'Cycling',
  snooker: 'Snooker'
}

const BOOKMAKERS = ['NeonBet', 'Bet365', 'Betfair', 'Pinnacle', 'William Hill', '1xBet', 'Unibet', 'Betway']

/* ──────────────────── Odds API integration ──────────────────── */

const ODDS_API_KEY = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_ODDS_API_KEY || '')
  : ''

const ODDS_API_SPORTS: Record<string, string> = {
  football: 'soccer_epl',
  basketball: 'basketball_nba',
  tennis: 'tennis_atp_french_open',
  hockey: 'icehockey_nhl',
  baseball: 'baseball_mlb',
  americanFootball: 'americanfootball_nfl',
  cricket: 'cricket_ipl',
  rugby: 'rugbyleague_nrl',
  golf: 'golf_pga_championship',
  boxing: 'boxing_boxing',
  mma: 'mma_mixed_martial_arts',
}

async function fetchLiveOdds(sportKey: string): Promise<any[]> {
  if (!ODDS_API_KEY) return []
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}` +
      `&regions=eu,uk&markets=h2h,totals&oddsFormat=decimal`
    )
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

/* ──────────────────── Match Generator ──────────────────── */

function randomOdds(base: number, variance = 0.3): number {
  return +(base + (Math.random() - 0.5) * variance * 2).toFixed(2)
}

function generateBookmakerOdds(home: number, draw: number | undefined, away: number): BookmakerOdds[] {
  return BOOKMAKERS.map(bk => ({
    bookmaker: bk,
    home: randomOdds(home, bk === 'NeonBet' ? 0.05 : 0.15),
    draw: draw !== undefined ? randomOdds(draw, bk === 'NeonBet' ? 0.05 : 0.15) : undefined,
    away: randomOdds(away, bk === 'NeonBet' ? 0.05 : 0.15),
  }))
}

function makeMatch(
  id: string, sport: string, league: string,
  home: string, away: string,
  homeOdds: number, drawOdds: number | undefined, awayOdds: number,
  opts: Partial<MatchEvent> = {}
): MatchEvent {
  const ou = opts.markets?.overUnder || (drawOdds !== undefined
    ? { over: randomOdds(1.85, 0.1), under: randomOdds(1.95, 0.1), line: 2.5 }
    : undefined)
  const btts = drawOdds !== undefined
    ? { yes: randomOdds(1.75, 0.12), no: randomOdds(2.05, 0.12) }
    : undefined
  return {
    id, sport, league, homeTeam: home, awayTeam: away,
    startTime: opts.startTime || new Date(Date.now() + Math.random() * 86400000 * 3),
    isLive: opts.isLive || false,
    homeScore: opts.homeScore,
    awayScore: opts.awayScore,
    minute: opts.minute,
    period: opts.period,
    featured: opts.featured,
    boosted: opts.boosted,
    markets: {
      matchWinner: { home: homeOdds, draw: drawOdds, away: awayOdds },
      overUnder: ou,
      bothTeamsScore: btts,
      handicap: drawOdds !== undefined ? {
        home: randomOdds(1.9, 0.08), away: randomOdds(1.9, 0.08),
        line: Math.random() > 0.5 ? '-1.5' : '+1.5'
      } : undefined,
    },
    bookmakers: generateBookmakerOdds(homeOdds, drawOdds, awayOdds),
  }
}

function generateAllMatches(): MatchEvent[] {
  const now = Date.now()
  const h = (hrs: number) => new Date(now + hrs * 3600000)

  return [
    // ═══════════════ FOOTBALL ═══════════════
    // Premier League
    makeMatch('fb1', 'football', 'Premier League', 'Arsenal', 'Liverpool', 2.45, 3.30, 2.90,
      { isLive: true, homeScore: 1, awayScore: 1, minute: 67, featured: true }),
    makeMatch('fb2', 'football', 'Premier League', 'Manchester City', 'Chelsea', 1.55, 4.20, 5.80,
      { isLive: true, homeScore: 2, awayScore: 0, minute: 34, featured: true }),
    makeMatch('fb3', 'football', 'Premier League', 'Tottenham', 'Manchester United', 2.10, 3.40, 3.50,
      { startTime: h(2), boosted: true }),
    makeMatch('fb4', 'football', 'Premier League', 'Newcastle', 'Aston Villa', 2.20, 3.35, 3.25,
      { startTime: h(5) }),
    makeMatch('fb5', 'football', 'Premier League', 'Brighton', 'West Ham', 1.90, 3.50, 4.00,
      { startTime: h(26) }),
    makeMatch('fb6', 'football', 'Premier League', 'Everton', 'Fulham', 2.60, 3.20, 2.80,
      { startTime: h(48) }),
    // La Liga
    makeMatch('fb7', 'football', 'La Liga', 'Real Madrid', 'Barcelona', 2.30, 3.40, 3.00,
      { isLive: true, homeScore: 2, awayScore: 1, minute: 78, featured: true }),
    makeMatch('fb8', 'football', 'La Liga', 'Atletico Madrid', 'Real Sociedad', 1.75, 3.60, 4.50,
      { startTime: h(4) }),
    makeMatch('fb9', 'football', 'La Liga', 'Sevilla', 'Valencia', 2.15, 3.30, 3.40,
      { startTime: h(28) }),
    makeMatch('fb10', 'football', 'La Liga', 'Villarreal', 'Real Betis', 2.25, 3.25, 3.20,
      { startTime: h(52) }),
    // Serie A
    makeMatch('fb11', 'football', 'Serie A', 'AC Milan', 'Inter Milan', 2.80, 3.20, 2.55,
      { isLive: true, homeScore: 0, awayScore: 0, minute: 12, featured: true }),
    makeMatch('fb12', 'football', 'Serie A', 'Juventus', 'Napoli', 2.10, 3.30, 3.50,
      { startTime: h(6) }),
    makeMatch('fb13', 'football', 'Serie A', 'Roma', 'Lazio', 2.40, 3.25, 3.00,
      { startTime: h(30) }),
    makeMatch('fb14', 'football', 'Serie A', 'Atalanta', 'Bologna', 1.85, 3.60, 4.20,
      { startTime: h(54) }),
    // Bundesliga
    makeMatch('fb15', 'football', 'Bundesliga', 'Bayern Munich', 'Borussia Dortmund', 1.50, 4.30, 6.00,
      { startTime: h(3), featured: true, boosted: true }),
    makeMatch('fb16', 'football', 'Bundesliga', 'RB Leipzig', 'Bayer Leverkusen', 2.60, 3.25, 2.70,
      { startTime: h(27) }),
    makeMatch('fb17', 'football', 'Bundesliga', 'Eintracht Frankfurt', 'Wolfsburg', 1.95, 3.50, 3.90,
      { startTime: h(51) }),
    // Ligue 1
    makeMatch('fb18', 'football', 'Ligue 1', 'PSG', 'Marseille', 1.40, 4.80, 7.50,
      { startTime: h(7), featured: true }),
    makeMatch('fb19', 'football', 'Ligue 1', 'Lyon', 'Monaco', 2.50, 3.30, 2.85,
      { startTime: h(31) }),
    makeMatch('fb20', 'football', 'Ligue 1', 'Lille', 'Nice', 2.05, 3.40, 3.60,
      { startTime: h(55) }),
    // Champions League
    makeMatch('fb21', 'football', 'Champions League', 'Real Madrid', 'Manchester City', 2.20, 3.35, 3.20,
      { startTime: h(8), featured: true, boosted: true }),
    makeMatch('fb22', 'football', 'Champions League', 'Bayern Munich', 'PSG', 1.85, 3.60, 4.10,
      { startTime: h(8) }),
    makeMatch('fb23', 'football', 'Champions League', 'Barcelona', 'Arsenal', 2.30, 3.40, 3.00,
      { startTime: h(32) }),
    makeMatch('fb24', 'football', 'Champions League', 'Inter Milan', 'Liverpool', 2.70, 3.20, 2.65,
      { startTime: h(32) }),
    // Europa League
    makeMatch('fb25', 'football', 'Europa League', 'Roma', 'Tottenham', 2.40, 3.30, 2.95,
      { startTime: h(56) }),
    makeMatch('fb26', 'football', 'Europa League', 'Ajax', 'Sevilla', 2.55, 3.25, 2.80,
      { startTime: h(56) }),
    // MLS
    makeMatch('fb27', 'football', 'MLS', 'Inter Miami', 'LA Galaxy', 1.80, 3.70, 4.30,
      { startTime: h(10) }),
    makeMatch('fb28', 'football', 'MLS', 'Atlanta United', 'LAFC', 2.90, 3.20, 2.45,
      { startTime: h(34) }),
    // Eredivisie
    makeMatch('fb29', 'football', 'Eredivisie', 'PSV', 'Ajax', 1.95, 3.55, 3.80,
      { startTime: h(58) }),
    // Liga Portugal
    makeMatch('fb30', 'football', 'Liga Portugal', 'Benfica', 'Porto', 2.15, 3.35, 3.40,
      { startTime: h(60) }),

    // ═══════════════ BASKETBALL ═══════════════
    // NBA
    makeMatch('bb1', 'basketball', 'NBA', 'LA Lakers', 'Boston Celtics', 2.30, undefined, 1.65,
      { isLive: true, homeScore: 87, awayScore: 92, period: 'Q3', featured: true }),
    makeMatch('bb2', 'basketball', 'NBA', 'Golden State Warriors', 'Milwaukee Bucks', 1.85, undefined, 1.95,
      { isLive: true, homeScore: 54, awayScore: 51, period: 'Q2' }),
    makeMatch('bb3', 'basketball', 'NBA', 'Denver Nuggets', 'Phoenix Suns', 1.70, undefined, 2.15,
      { startTime: h(4) }),
    makeMatch('bb4', 'basketball', 'NBA', 'Miami Heat', 'Philadelphia 76ers', 2.10, undefined, 1.75,
      { startTime: h(5) }),
    makeMatch('bb5', 'basketball', 'NBA', 'Dallas Mavericks', 'Minnesota Timberwolves', 1.95, undefined, 1.85,
      { startTime: h(6), boosted: true }),
    makeMatch('bb6', 'basketball', 'NBA', 'New York Knicks', 'Brooklyn Nets', 1.55, undefined, 2.50,
      { startTime: h(28) }),
    makeMatch('bb7', 'basketball', 'NBA', 'Sacramento Kings', 'OKC Thunder', 2.40, undefined, 1.57,
      { startTime: h(29) }),
    makeMatch('bb8', 'basketball', 'NBA', 'Cleveland Cavaliers', 'Indiana Pacers', 1.65, undefined, 2.25,
      { startTime: h(52) }),
    // EuroLeague
    makeMatch('bb9', 'basketball', 'EuroLeague', 'Real Madrid', 'Fenerbahce', 1.55, undefined, 2.50,
      { startTime: h(9) }),
    makeMatch('bb10', 'basketball', 'EuroLeague', 'Olympiacos', 'Barcelona', 2.20, undefined, 1.70,
      { startTime: h(33) }),
    // NCAA
    makeMatch('bb11', 'basketball', 'NCAA', 'Duke', 'UNC', 1.80, undefined, 2.00,
      { startTime: h(11) }),

    // ═══════════════ TENNIS ═══════════════
    // ATP
    makeMatch('tn1', 'tennis', 'ATP Masters 1000', 'Carlos Alcaraz', 'Novak Djokovic', 1.75, undefined, 2.10,
      { isLive: true, homeScore: 2, awayScore: 1, period: 'Set 4', featured: true }),
    makeMatch('tn2', 'tennis', 'ATP Masters 1000', 'Jannik Sinner', 'Daniil Medvedev', 1.55, undefined, 2.45,
      { startTime: h(3) }),
    makeMatch('tn3', 'tennis', 'ATP 500', 'Alexander Zverev', 'Stefanos Tsitsipas', 1.90, undefined, 1.90,
      { startTime: h(12) }),
    makeMatch('tn4', 'tennis', 'ATP 500', 'Andrey Rublev', 'Holger Rune', 1.65, undefined, 2.25,
      { startTime: h(36) }),
    // WTA
    makeMatch('tn5', 'tennis', 'WTA 1000', 'Iga Swiatek', 'Aryna Sabalenka', 1.80, undefined, 2.00,
      { startTime: h(4), boosted: true }),
    makeMatch('tn6', 'tennis', 'WTA 1000', 'Coco Gauff', 'Jessica Pegula', 1.70, undefined, 2.15,
      { startTime: h(13) }),
    makeMatch('tn7', 'tennis', 'WTA 500', 'Elena Rybakina', 'Ons Jabeur', 1.85, undefined, 1.95,
      { startTime: h(37) }),

    // ═══════════════ UFC / MMA ═══════════════
    makeMatch('ufc1', 'ufc', 'UFC 310', 'Alex Pereira', 'Khalil Rountree', 1.35, undefined, 3.20,
      { startTime: h(14), featured: true, boosted: true }),
    makeMatch('ufc2', 'ufc', 'UFC 310', 'Islam Makhachev', 'Charles Oliveira', 1.50, undefined, 2.60,
      { startTime: h(14) }),
    makeMatch('ufc3', 'ufc', 'UFC Fight Night', 'Sean O\'Malley', 'Merab Dvalishvili', 2.10, undefined, 1.75,
      { startTime: h(38) }),
    makeMatch('ufc4', 'ufc', 'UFC Fight Night', 'Dricus Du Plessis', 'Robert Whittaker', 1.65, undefined, 2.25,
      { startTime: h(62) }),
    makeMatch('ufc5', 'ufc', 'Bellator', 'Patricio Pitbull', 'AJ McKee', 2.30, undefined, 1.63,
      { startTime: h(70) }),

    // ═══════════════ ESPORTS ═══════════════
    // CS2
    makeMatch('es1', 'esports', 'CS2 Major', 'FaZe Clan', 'Natus Vincere', 1.85, undefined, 1.95,
      { isLive: true, homeScore: 1, awayScore: 1, period: 'Map 3', featured: true }),
    makeMatch('es2', 'esports', 'CS2 Major', 'G2 Esports', 'Team Vitality', 2.10, undefined, 1.75,
      { startTime: h(3) }),
    makeMatch('es3', 'esports', 'CS2 Pro League', 'Cloud9', 'Heroic', 1.70, undefined, 2.15,
      { startTime: h(15) }),
    // LoL
    makeMatch('es4', 'esports', 'LoL Worlds', 'T1', 'Gen.G', 1.60, undefined, 2.35,
      { startTime: h(5), featured: true }),
    makeMatch('es5', 'esports', 'LoL Worlds', 'JDG', 'Bilibili Gaming', 1.90, undefined, 1.90,
      { startTime: h(16) }),
    // Valorant
    makeMatch('es6', 'esports', 'Valorant Champions', 'Fnatic', 'Sentinels', 1.75, undefined, 2.10,
      { startTime: h(7), boosted: true }),
    makeMatch('es7', 'esports', 'Valorant Champions', 'DRX', 'Paper Rex', 2.00, undefined, 1.80,
      { startTime: h(39) }),
    // Dota 2
    makeMatch('es8', 'esports', 'The International', 'Team Spirit', 'OG', 1.65, undefined, 2.25,
      { startTime: h(17) }),
    makeMatch('es9', 'esports', 'The International', 'PSG.LGD', 'Team Liquid', 1.80, undefined, 2.00,
      { startTime: h(40) }),

    // ═══════════════ ICE HOCKEY ═══════════════
    makeMatch('hk1', 'hockey', 'NHL', 'Toronto Maple Leafs', 'Montreal Canadiens', 1.70, undefined, 2.15,
      { isLive: true, homeScore: 3, awayScore: 2, period: '2nd Period' }),
    makeMatch('hk2', 'hockey', 'NHL', 'New York Rangers', 'Boston Bruins', 2.10, undefined, 1.75,
      { startTime: h(6) }),
    makeMatch('hk3', 'hockey', 'NHL', 'Colorado Avalanche', 'Edmonton Oilers', 1.85, undefined, 1.95,
      { startTime: h(7), boosted: true }),
    makeMatch('hk4', 'hockey', 'NHL', 'Vegas Golden Knights', 'Dallas Stars', 1.90, undefined, 1.90,
      { startTime: h(30) }),
    makeMatch('hk5', 'hockey', 'NHL', 'Tampa Bay Lightning', 'Florida Panthers', 2.20, undefined, 1.68,
      { startTime: h(54) }),
    makeMatch('hk6', 'hockey', 'KHL', 'CSKA Moscow', 'SKA St Petersburg', 2.05, undefined, 1.80,
      { startTime: h(18) }),

    // ═══════════════ BASEBALL ═══════════════
    makeMatch('bs1', 'baseball', 'MLB', 'NY Yankees', 'Boston Red Sox', 1.75, undefined, 2.10,
      { startTime: h(8), featured: true }),
    makeMatch('bs2', 'baseball', 'MLB', 'LA Dodgers', 'San Francisco Giants', 1.55, undefined, 2.45,
      { startTime: h(9) }),
    makeMatch('bs3', 'baseball', 'MLB', 'Houston Astros', 'Texas Rangers', 1.85, undefined, 1.95,
      { startTime: h(32) }),
    makeMatch('bs4', 'baseball', 'MLB', 'Atlanta Braves', 'Philadelphia Phillies', 2.00, undefined, 1.80,
      { startTime: h(56) }),
    makeMatch('bs5', 'baseball', 'NPB', 'Yomiuri Giants', 'Hanshin Tigers', 1.90, undefined, 1.90,
      { startTime: h(19) }),

    // ═══════════════ AMERICAN FOOTBALL ═══════════════
    makeMatch('af1', 'americanFootball', 'NFL', 'Kansas City Chiefs', 'Buffalo Bills', 1.65, undefined, 2.25,
      { startTime: h(10), featured: true, boosted: true }),
    makeMatch('af2', 'americanFootball', 'NFL', 'San Francisco 49ers', 'Dallas Cowboys', 1.80, undefined, 2.00,
      { startTime: h(10) }),
    makeMatch('af3', 'americanFootball', 'NFL', 'Philadelphia Eagles', 'Miami Dolphins', 1.55, undefined, 2.45,
      { startTime: h(34) }),
    makeMatch('af4', 'americanFootball', 'NFL', 'Detroit Lions', 'Green Bay Packers', 1.90, undefined, 1.90,
      { startTime: h(34) }),

    // ═══════════════ CRICKET ═══════════════
    makeMatch('cr1', 'cricket', 'IPL', 'Mumbai Indians', 'Chennai Super Kings', 1.85, undefined, 1.95,
      { startTime: h(11), featured: true }),
    makeMatch('cr2', 'cricket', 'IPL', 'Royal Challengers', 'Kolkata Knight Riders', 2.10, undefined, 1.75,
      { startTime: h(35) }),
    makeMatch('cr3', 'cricket', 'IPL', 'Delhi Capitals', 'Punjab Kings', 1.70, undefined, 2.15,
      { startTime: h(59) }),
    makeMatch('cr4', 'cricket', 'The Ashes', 'Australia', 'England', 1.50, 4.00, 6.50,
      { startTime: h(20) }),

    // ═══════════════ RUGBY ═══════════════
    makeMatch('rg1', 'rugby', 'Six Nations', 'England', 'France', 2.30, undefined, 1.63,
      { startTime: h(12) }),
    makeMatch('rg2', 'rugby', 'Six Nations', 'Ireland', 'South Africa', 1.95, undefined, 1.85,
      { startTime: h(36) }),
    makeMatch('rg3', 'rugby', 'Super Rugby', 'Crusaders', 'Blues', 2.15, undefined, 1.72,
      { startTime: h(60) }),

    // ═══════════════ BOXING ═══════════════
    makeMatch('bx1', 'boxing', 'World Championship', 'Tyson Fury', 'Oleksandr Usyk', 2.20, undefined, 1.68,
      { startTime: h(48), featured: true, boosted: true }),
    makeMatch('bx2', 'boxing', 'Super Middleweight', 'Canelo Alvarez', 'David Benavidez', 1.75, undefined, 2.10,
      { startTime: h(72) }),

    // ═══════════════ GOLF ═══════════════
    makeMatch('gl1', 'golf', 'PGA Championship', 'Scottie Scheffler', 'Rory McIlroy', 1.85, undefined, 1.95,
      { startTime: h(24) }),
    makeMatch('gl2', 'golf', 'PGA Championship', 'Jon Rahm', 'Brooks Koepka', 1.90, undefined, 1.90,
      { startTime: h(24) }),

    // ═══════════════ HANDBALL ═══════════════
    makeMatch('hb1', 'handball', 'EHF Champions League', 'Barcelona', 'THW Kiel', 1.40, undefined, 2.90,
      { startTime: h(13) }),
    makeMatch('hb2', 'handball', 'EHF Champions League', 'PSG', 'Aalborg', 1.55, undefined, 2.45,
      { startTime: h(37) }),

    // ═══════════════ TABLE TENNIS ═══════════════
    makeMatch('tt1', 'tableTennis', 'WTT Champions', 'Fan Zhendong', 'Ma Long', 1.65, undefined, 2.25,
      { isLive: true, homeScore: 2, awayScore: 1, period: 'Set 4' }),
    makeMatch('tt2', 'tableTennis', 'WTT Champions', 'Wang Chuqin', 'Tomokazu Harimoto', 1.50, undefined, 2.55,
      { startTime: h(14) }),

    // ═══════════════ DARTS ═══════════════
    makeMatch('dt1', 'darts', 'PDC World Championship', 'Luke Humphries', 'Luke Littler', 1.80, undefined, 2.00,
      { startTime: h(15), boosted: true }),
    makeMatch('dt2', 'darts', 'PDC World Championship', 'Michael van Gerwen', 'Gerwyn Price', 1.70, undefined, 2.15,
      { startTime: h(39) }),

    // ═══════════════ VOLLEYBALL ═══════════════
    makeMatch('vb1', 'volleyball', 'CEV Champions League', 'Trentino', 'Zenit Kazan', 1.90, undefined, 1.90,
      { startTime: h(16) }),
    makeMatch('vb2', 'volleyball', 'CEV Champions League', 'Perugia', 'Jastrzebski', 1.65, undefined, 2.25,
      { startTime: h(40) }),

    // ═══════════════ F1 ═══════════════
    makeMatch('f1a', 'f1', 'Formula 1 GP', 'Max Verstappen', 'Lando Norris', 1.55, undefined, 2.45,
      { startTime: h(48), featured: true }),
    makeMatch('f1b', 'f1', 'Formula 1 GP', 'Charles Leclerc', 'Lewis Hamilton', 2.10, undefined, 1.75,
      { startTime: h(48) }),

    // ═══════════════ SNOOKER ═══════════════
    makeMatch('sn1', 'snooker', 'World Championship', 'Ronnie O\'Sullivan', 'Judd Trump', 1.90, undefined, 1.90,
      { startTime: h(20) }),
  ]
}

/* ──────────────────── Best Odds Analysis ──────────────────── */

function impliedProbability(odds: number): number {
  return 1 / odds
}

function findBestOdds(bookmakers: BookmakerOdds[], selection: 'home' | 'draw' | 'away'): {
  best: number, bestBookmaker: string, average: number, neonbet: number, edge: number
} {
  const values = bookmakers.map(b => ({
    bookmaker: b.bookmaker,
    odds: selection === 'draw' ? (b.draw || 0) : b[selection]
  })).filter(v => v.odds > 0)

  const best = Math.max(...values.map(v => v.odds))
  const bestBookmaker = values.find(v => v.odds === best)?.bookmaker || ''
  const average = values.reduce((s, v) => s + v.odds, 0) / values.length
  const neonbet = values.find(v => v.bookmaker === 'NeonBet')?.odds || 0
  const edge = ((neonbet - average) / average) * 100

  return { best, bestBookmaker, average, neonbet, edge }
}

function getMarketMargin(market: { home: number; draw?: number; away: number }): number {
  const ip = impliedProbability(market.home) +
    (market.draw ? impliedProbability(market.draw) : 0) +
    impliedProbability(market.away)
  return (ip - 1) * 100
}

function isValueBet(neonOdds: number, avgOdds: number): boolean {
  return neonOdds > avgOdds * 1.02
}

/* ──────────────────── Hooks ──────────────────── */

function useOddsFlicker(matches: MatchEvent[]) {
  const [flickerMap, setFlickerMap] = useState<Record<string, Record<string, 'up' | 'down' | null>>>({})
  const matchesRef = useRef(matches)
  matchesRef.current = matches

  useEffect(() => {
    const iv = setInterval(() => {
      const m = matchesRef.current
      if (!m.length) return
      const idx = Math.floor(Math.random() * m.length)
      const match = m[idx]
      const keys = ['home', 'away', ...(match.markets.matchWinner.draw !== undefined ? ['draw'] : [])] as const
      const key = keys[Math.floor(Math.random() * keys.length)]
      const dir = Math.random() > 0.5 ? 'up' : 'down'
      const delta = +(Math.random() * 0.08).toFixed(2)
      const mw = match.markets.matchWinner
      if (key === 'home') mw.home = Math.max(1.01, +(mw.home + (dir === 'up' ? delta : -delta)).toFixed(2))
      else if (key === 'away') mw.away = Math.max(1.01, +(mw.away + (dir === 'up' ? delta : -delta)).toFixed(2))
      else if (key === 'draw' && mw.draw) mw.draw = Math.max(1.01, +(mw.draw + (dir === 'up' ? delta : -delta)).toFixed(2))

      setFlickerMap(prev => ({
        ...prev,
        [match.id]: { ...prev[match.id], [key]: dir }
      }))
      setTimeout(() => {
        setFlickerMap(prev => ({
          ...prev,
          [match.id]: { ...prev[match.id], [key]: null }
        }))
      }, 800)
    }, 3000)
    return () => clearInterval(iv)
  }, [])

  return flickerMap
}

function useDemoBalance() {
  const [balance, setBalance] = useState(1000)
  useEffect(() => {
    const stored = localStorage.getItem('neonbet-demo-balance')
    if (stored) {
      try { const p = JSON.parse(stored); setBalance(p?.state?.balance ?? 1000) } catch { }
    }
  }, [])
  return balance
}

/* ──────────────────── Components ──────────────────── */

function OddsButton({
  odds, label, flicker, selected, onClick, isBest, isValue
}: {
  odds: number; label: string; flicker?: 'up' | 'down' | null
  selected?: boolean; onClick: () => void; isBest?: boolean; isValue?: boolean
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs font-medium transition-all
        ${selected
          ? 'bg-brand/30 border border-brand text-brand ring-1 ring-brand/40'
          : 'bg-surface/80 border border-border hover:border-brand/50 text-white'
        }
        ${flicker === 'up' ? 'ring-2 ring-emerald-500/60' : ''}
        ${flicker === 'down' ? 'ring-2 ring-red-500/60' : ''}
      `}
    >
      {isBest && (
        <span className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-black text-[8px] font-bold px-1 rounded">
          BEST
        </span>
      )}
      {isValue && !isBest && (
        <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-black text-[8px] font-bold px-1 rounded">
          VALUE
        </span>
      )}
      <span className="text-[10px] text-muted">{label}</span>
      <span className="text-sm font-bold flex items-center gap-0.5">
        {odds.toFixed(2)}
        <AnimatePresence>
          {flicker && (
            <motion.span
              initial={{ opacity: 0, y: flicker === 'up' ? 4 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={flicker === 'up' ? 'text-emerald-400' : 'text-red-400'}
            >
              {flicker === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  )
}

function OddsComparison({ bookmakers, selection }: { bookmakers: BookmakerOdds[]; selection: 'home' | 'draw' | 'away' }) {
  const analysis = findBestOdds(bookmakers, selection)
  const sorted = [...bookmakers]
    .map(b => ({ name: b.bookmaker, odds: selection === 'draw' ? (b.draw || 0) : b[selection] }))
    .filter(b => b.odds > 0)
    .sort((a, b) => b.odds - a.odds)

  return (
    <div className="bg-surface/60 rounded-lg p-3 border border-border">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 size={14} className="text-brand" />
        <span className="text-xs font-semibold text-white">
          Odds Comparison — {selection === 'home' ? 'Home' : selection === 'draw' ? 'Draw' : 'Away'}
        </span>
      </div>
      <div className="space-y-1">
        {sorted.map((b, i) => (
          <div key={b.name}
            className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
              i === 0 ? 'bg-yellow-500/10 border border-yellow-500/30' :
              b.name === 'NeonBet' ? 'bg-brand/10 border border-brand/30' : ''
            }`}
          >
            <span className={`${i === 0 ? 'text-yellow-400 font-bold' : b.name === 'NeonBet' ? 'text-brand font-semibold' : 'text-muted'}`}>
              {b.name}
              {i === 0 && ' 👑'}
              {b.name === 'NeonBet' && i !== 0 && ' ⚡'}
            </span>
            <span className={`font-mono font-bold ${i === 0 ? 'text-yellow-400' : 'text-white'}`}>
              {b.odds.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-3 gap-2 text-[10px]">
        <div className="text-center">
          <div className="text-muted">Market Avg</div>
          <div className="text-white font-bold">{analysis.average.toFixed(2)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted">Implied Prob</div>
          <div className="text-white font-bold">{(impliedProbability(analysis.average) * 100).toFixed(1)}%</div>
        </div>
        <div className="text-center">
          <div className="text-muted">NeonBet Edge</div>
          <div className={`font-bold ${analysis.edge > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {analysis.edge > 0 ? '+' : ''}{analysis.edge.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}

function BetSlipPanel({
  betSlip, stake, setStake, onRemove, onClear, onPlace, balance
}: {
  betSlip: BetSlipItem[]; stake: string; setStake: (s: string) => void
  onRemove: (id: string) => void; onClear: () => void; onPlace: () => void
  balance: number
}) {
  const totalOdds = betSlip.reduce((acc, b) => acc * b.odds, 1)
  const potentialWin = parseFloat(stake || '0') * totalOdds

  return (
    <div className="bg-surface rounded-xl border border-border p-4 sticky top-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap size={14} className="text-brand" /> Bet Slip
          <span className="bg-brand/20 text-brand text-xs px-2 py-0.5 rounded-full">{betSlip.length}</span>
        </h3>
        {betSlip.length > 0 && (
          <button onClick={onClear} className="text-xs text-muted hover:text-red-400 transition-colors">
            Clear All
          </button>
        )}
      </div>

      {betSlip.length === 0 ? (
        <div className="text-center py-8 text-muted text-xs">
          <Target size={24} className="mx-auto mb-2 opacity-40" />
          Click any odds to add selections
        </div>
      ) : (
        <>
          <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
            {betSlip.map(bet => (
              <div key={bet.matchId + bet.selection}
                className="bg-surface/80 border border-border rounded-lg p-2 text-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-muted text-[10px] mb-0.5">{bet.match}</div>
                    <div className="text-white font-semibold">{bet.selection}</div>
                    <div className="text-brand font-bold">{bet.odds.toFixed(2)}</div>
                  </div>
                  <button onClick={() => onRemove(bet.matchId + bet.selection)}
                    className="text-muted hover:text-red-400 p-0.5">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {betSlip.length > 1 && (
            <div className="bg-brand/10 border border-brand/30 rounded-lg p-2 mb-3 text-xs">
              <div className="flex justify-between text-muted">
                <span>Combo ({betSlip.length} legs)</span>
                <span className="text-brand font-bold">×{totalOdds.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex gap-1">
              {[5, 10, 25, 50, 100].map(v => (
                <button key={v} onClick={() => setStake(String(v))}
                  className={`flex-1 py-1 rounded text-xs font-medium transition-colors
                    ${stake === String(v) ? 'bg-brand text-black' : 'bg-surface border border-border text-muted hover:text-white'}`}
                >
                  ${v}
                </button>
              ))}
            </div>
            <input
              type="number" value={stake} onChange={e => setStake(e.target.value)}
              placeholder="Stake ($)" min="0.01" step="0.01"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:border-brand outline-none"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>Potential win</span>
              <span className="text-emerald-400 font-bold">${potentialWin.toFixed(2)}</span>
            </div>
            <button onClick={onPlace}
              disabled={!stake || parseFloat(stake) <= 0 || parseFloat(stake) > balance}
              className="w-full py-2.5 rounded-lg bg-brand text-black font-bold text-sm hover:bg-brand/90
                disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Place Bet — ${parseFloat(stake || '0').toFixed(2)}
            </button>
            <div className="text-center text-[10px] text-muted">
              Demo Balance: <span className="text-white">${balance.toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ──────────────────── Main Page ──────────────────── */

export default function SportsPage() {
  const [allMatches] = useState<MatchEvent[]>(() => generateAllMatches())
  const [selectedSport, setSelectedSport] = useState<string>('all')
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'boosted'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [betSlip, setBetSlip] = useState<BetSlipItem[]>([])
  const [stake, setStake] = useState('10')
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null)
  const [showAnalysis, setShowAnalysis] = useState<string | null>(null)
  const [showMobileBetSlip, setShowMobileBetSlip] = useState(false)
  const balance = useDemoBalance()
  const flickerMap = useOddsFlicker(allMatches)

  // Available sports derived from data
  const sports = useMemo(() => {
    const s = new Set(allMatches.map(m => m.sport))
    return Array.from(s)
  }, [allMatches])

  // Filtered matches
  const filteredMatches = useMemo(() => {
    let out = allMatches
    if (selectedSport !== 'all') out = out.filter(m => m.sport === selectedSport)
    if (filter === 'live') out = out.filter(m => m.isLive)
    else if (filter === 'upcoming') out = out.filter(m => !m.isLive)
    else if (filter === 'boosted') out = out.filter(m => m.boosted)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      out = out.filter(m =>
        m.homeTeam.toLowerCase().includes(q) ||
        m.awayTeam.toLowerCase().includes(q) ||
        m.league.toLowerCase().includes(q) ||
        m.sport.toLowerCase().includes(q)
      )
    }
    return out
  }, [allMatches, selectedSport, filter, searchQuery])

  // Group by league
  const groupedByLeague = useMemo(() => {
    const groups: Record<string, MatchEvent[]> = {}
    filteredMatches.forEach(m => {
      const key = `${m.sport}|${m.league}`
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    })
    return groups
  }, [filteredMatches])

  const featuredMatches = allMatches.filter(m => m.featured)
  const liveCount = allMatches.filter(m => m.isLive).length
  const boostedCount = allMatches.filter(m => m.boosted).length

  function toggleBet(matchId: string, match: string, selection: string, odds: number, market: string) {
    setBetSlip(prev => {
      const key = matchId + selection
      const exists = prev.find(b => b.matchId + b.selection === key)
      if (exists) return prev.filter(b => b.matchId + b.selection !== key)
      return [...prev, { matchId, match, selection, odds, market }]
    })
  }

  function placeBet() {
    const amount = parseFloat(stake)
    if (!amount || amount <= 0 || betSlip.length === 0) return
    const totalOdds = betSlip.reduce((a, b) => a * b.odds, 1)
    const won = Math.random() < (1 / totalOdds) * 0.97
    const payout = won ? amount * totalOdds : 0
    alert(won
      ? `🎉 WIN! You won $${payout.toFixed(2)} at ${totalOdds.toFixed(2)}x odds!`
      : `😔 Lost $${amount.toFixed(2)}. Better luck next time!`
    )
    setBetSlip([])
  }

  function formatTime(date: Date): string {
    const diff = date.getTime() - Date.now()
    if (diff < 0) return 'Started'
    if (diff < 3600000) return `${Math.ceil(diff / 60000)}min`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`
    const days = Math.floor(diff / 86400000)
    return `${days}d ${Math.floor((diff % 86400000) / 3600000)}h`
  }

  return (
    <div className="min-h-screen bg-background text-white pb-mobile-nav">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-r from-surface via-surface to-brand/5">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <div className="relative max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
                <Globe2 className="text-brand" size={28} />
                NeonBet Sportsbook
              </h1>
              <p className="text-muted text-sm mt-1 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Activity size={12} className="text-emerald-400" />
                  {liveCount} Live
                </span>
                <span>{allMatches.length} Events</span>
                <span>{Object.keys(groupedByLeague).length} Leagues</span>
                <span className="flex items-center gap-1">
                  <Flame size={12} className="text-orange-400" />
                  {boostedCount} Boosted
                </span>
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-xs">
                <Sparkles size={12} className="text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Best Odds Guaranteed</span>
              </div>
              <div className="flex items-center gap-1 bg-brand/10 border border-brand/30 rounded-lg px-3 py-1.5 text-xs">
                <BarChart3 size={12} className="text-brand" />
                <span className="text-brand font-semibold">Market Analysis</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search teams, leagues, sports..."
              className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-brand outline-none"
            />
          </div>
          <div className="flex gap-2">
            {([
              { key: 'all', label: 'All', icon: null },
              { key: 'live', label: `Live (${liveCount})`, icon: <Activity size={12} className="text-red-400" /> },
              { key: 'upcoming', label: 'Upcoming', icon: <Clock size={12} /> },
              { key: 'boosted', label: `Boosted (${boostedCount})`, icon: <Flame size={12} className="text-orange-400" /> },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all
                  ${filter === f.key ? 'bg-brand text-black' : 'bg-surface border border-border text-muted hover:text-white'}`}
              >
                {f.icon}{f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sport Pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
          <button onClick={() => setSelectedSport('all')}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all
              ${selectedSport === 'all' ? 'bg-brand text-black' : 'bg-surface border border-border text-muted hover:text-white'}`}
          >
            <Globe2 size={12} /> All Sports
          </button>
          {sports.map(sport => (
            <button key={sport} onClick={() => setSelectedSport(sport)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap
                ${selectedSport === sport ? 'bg-brand text-black' : 'bg-surface border border-border text-muted hover:text-white'}`}
            >
              <span>{SPORT_ICONS[sport] || '🏆'}</span>
              {SPORT_LABELS[sport] || sport}
              <span className="bg-white/10 rounded px-1.5 text-[10px]">
                {allMatches.filter(m => m.sport === sport).length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Featured Matches */}
            {filter === 'all' && selectedSport === 'all' && !searchQuery && (
              <div className="mb-6">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                  <Star size={14} className="text-yellow-400" /> Featured Matches
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {featuredMatches.slice(0, 6).map(match => (
                    <motion.div key={match.id}
                      whileHover={{ scale: 1.01 }}
                      className="bg-gradient-to-br from-surface to-brand/5 rounded-xl border border-brand/30 p-4 cursor-pointer"
                      onClick={() => setExpandedMatch(expandedMatch === match.id ? null : match.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span>{SPORT_ICONS[match.sport]}</span>
                          <span className="text-[10px] text-muted">{match.league}</span>
                        </div>
                        {match.isLive ? (
                          <span className="flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> LIVE {match.minute}&apos;
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted flex items-center gap-1">
                            <Clock size={10} /> {formatTime(match.startTime)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-white">{match.homeTeam}</div>
                          <div className="text-sm font-bold text-white">{match.awayTeam}</div>
                        </div>
                        {match.isLive && (
                          <div className="text-right space-y-1">
                            <div className="text-lg font-black text-brand">{match.homeScore}</div>
                            <div className="text-lg font-black text-brand">{match.awayScore}</div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <OddsButton
                          odds={match.markets.matchWinner.home} label="1"
                          flicker={flickerMap[match.id]?.home}
                          selected={betSlip.some(b => b.matchId === match.id && b.selection.includes(match.homeTeam))}
                          isBest={findBestOdds(match.bookmakers, 'home').bestBookmaker === 'NeonBet'}
                          isValue={isValueBet(
                            findBestOdds(match.bookmakers, 'home').neonbet,
                            findBestOdds(match.bookmakers, 'home').average
                          )}
                          onClick={() => toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, match.homeTeam, match.markets.matchWinner.home, '1X2')}
                        />
                        {match.markets.matchWinner.draw !== undefined && (
                          <OddsButton
                            odds={match.markets.matchWinner.draw} label="X"
                            flicker={flickerMap[match.id]?.draw}
                            selected={betSlip.some(b => b.matchId === match.id && b.selection === 'Draw')}
                            onClick={() => toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, 'Draw', match.markets.matchWinner.draw!, '1X2')}
                          />
                        )}
                        <OddsButton
                          odds={match.markets.matchWinner.away} label="2"
                          flicker={flickerMap[match.id]?.away}
                          selected={betSlip.some(b => b.matchId === match.id && b.selection.includes(match.awayTeam))}
                          isBest={findBestOdds(match.bookmakers, 'away').bestBookmaker === 'NeonBet'}
                          isValue={isValueBet(
                            findBestOdds(match.bookmakers, 'away').neonbet,
                            findBestOdds(match.bookmakers, 'away').average
                          )}
                          onClick={() => toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, match.awayTeam, match.markets.matchWinner.away, '1X2')}
                        />
                      </div>
                      {match.boosted && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-400">
                          <Flame size={10} /> Odds Boosted
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Match count */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted">{filteredMatches.length} matches found</span>
              <div className="flex items-center gap-1 text-[10px] text-muted">
                <Eye size={10} /> Click match to expand markets
              </div>
            </div>

            {/* Matches by League */}
            <div className="space-y-4">
              {Object.entries(groupedByLeague).map(([key, matches]) => {
                const [sport, league] = key.split('|')
                return (
                  <div key={key} className="bg-surface rounded-xl border border-border overflow-hidden">
                    {/* League Header */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface/80">
                      <span className="text-base">{SPORT_ICONS[sport] || '🏆'}</span>
                      <span className="text-xs font-bold text-white">{league}</span>
                      <span className="text-[10px] text-muted">({matches.length})</span>
                      <span className="ml-auto text-[10px] text-muted">1X2</span>
                    </div>

                    {/* Matches */}
                    <div className="divide-y divide-border/50">
                      {matches.map(match => {
                        const homeAnalysis = findBestOdds(match.bookmakers, 'home')
                        const awayAnalysis = findBestOdds(match.bookmakers, 'away')
                        const drawAnalysis = match.markets.matchWinner.draw !== undefined
                          ? findBestOdds(match.bookmakers, 'draw') : null
                        const margin = getMarketMargin(match.markets.matchWinner)
                        const isExpanded = expandedMatch === match.id

                        return (
                          <div key={match.id} className="group">
                            <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                              onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                            >
                              {/* Time / Live */}
                              <div className="w-14 shrink-0 text-center">
                                {match.isLive ? (
                                  <div>
                                    <div className="flex items-center justify-center gap-1 text-red-400 text-[10px] font-bold">
                                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                                      LIVE
                                    </div>
                                    <div className="text-xs text-muted">
                                      {match.minute ? `${match.minute}'` : match.period}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-muted leading-tight">
                                    <div>{match.startTime.toLocaleDateString('en', { day: '2-digit', month: 'short' })}</div>
                                    <div>{match.startTime.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</div>
                                  </div>
                                )}
                              </div>

                              {/* Teams & Score */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-white truncate">{match.homeTeam}</span>
                                  {match.isLive && (
                                    <span className="text-sm font-black text-brand">{match.homeScore}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-white truncate">{match.awayTeam}</span>
                                  {match.isLive && (
                                    <span className="text-sm font-black text-brand">{match.awayScore}</span>
                                  )}
                                </div>
                              </div>

                              {/* Boosted tag */}
                              {match.boosted && (
                                <div className="shrink-0 hidden sm:flex items-center gap-1 text-[10px] text-orange-400 bg-orange-400/10 rounded px-1.5 py-0.5">
                                  <Flame size={10} /> Boosted
                                </div>
                              )}

                              {/* Odds */}
                              <div className="flex gap-1.5 shrink-0">
                                <OddsButton
                                  odds={match.markets.matchWinner.home} label="1"
                                  flicker={flickerMap[match.id]?.home}
                                  selected={betSlip.some(b => b.matchId === match.id && b.selection.includes(match.homeTeam))}
                                  isBest={homeAnalysis.bestBookmaker === 'NeonBet'}
                                  isValue={isValueBet(homeAnalysis.neonbet, homeAnalysis.average)}
                                  onClick={() => { toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, match.homeTeam, match.markets.matchWinner.home, '1X2') }}
                                />
                                {match.markets.matchWinner.draw !== undefined && (
                                  <OddsButton
                                    odds={match.markets.matchWinner.draw} label="X"
                                    flicker={flickerMap[match.id]?.draw}
                                    selected={betSlip.some(b => b.matchId === match.id && b.selection === 'Draw')}
                                    isBest={drawAnalysis?.bestBookmaker === 'NeonBet'}
                                    isValue={drawAnalysis ? isValueBet(drawAnalysis.neonbet, drawAnalysis.average) : false}
                                    onClick={() => { toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, 'Draw', match.markets.matchWinner.draw!, '1X2') }}
                                  />
                                )}
                                <OddsButton
                                  odds={match.markets.matchWinner.away} label="2"
                                  flicker={flickerMap[match.id]?.away}
                                  selected={betSlip.some(b => b.matchId === match.id && b.selection.includes(match.awayTeam))}
                                  isBest={awayAnalysis.bestBookmaker === 'NeonBet'}
                                  isValue={isValueBet(awayAnalysis.neonbet, awayAnalysis.average)}
                                  onClick={() => { toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, match.awayTeam, match.markets.matchWinner.away, '1X2') }}
                                />
                              </div>

                              {/* Expand Arrow */}
                              <ChevronDown size={14}
                                className={`shrink-0 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </div>

                            {/* Expanded Markets Panel */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 space-y-3">
                                    {/* Market Margin Info */}
                                    <div className="flex items-center gap-3 text-[10px]">
                                      <span className="text-muted flex items-center gap-1">
                                        <Percent size={10} /> Market Margin: <span className="text-white font-bold">{margin.toFixed(1)}%</span>
                                      </span>
                                      <span className="text-muted flex items-center gap-1">
                                        <Shield size={10} /> Bookmakers: <span className="text-white font-bold">{match.bookmakers.length}</span>
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setShowAnalysis(showAnalysis === match.id ? null : match.id) }}
                                        className="ml-auto flex items-center gap-1 text-brand hover:text-brand/80 font-semibold"
                                      >
                                        <BarChart3 size={10} /> {showAnalysis === match.id ? 'Hide' : 'View'} Odds Analysis
                                      </button>
                                    </div>

                                    {/* Odds Analysis Panel */}
                                    {showAnalysis === match.id && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
                                      >
                                        <OddsComparison bookmakers={match.bookmakers} selection="home" />
                                        {match.markets.matchWinner.draw !== undefined && (
                                          <OddsComparison bookmakers={match.bookmakers} selection="draw" />
                                        )}
                                        <OddsComparison bookmakers={match.bookmakers} selection="away" />
                                      </motion.div>
                                    )}

                                    {/* Additional Markets */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {/* Over/Under */}
                                      {match.markets.overUnder && (
                                        <div className="bg-surface/60 rounded-lg p-3 border border-border">
                                          <div className="text-[10px] text-muted mb-2 font-semibold">
                                            Over/Under {match.markets.overUnder.line}
                                          </div>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, `Over ${match.markets.overUnder!.line}`, match.markets.overUnder!.over, 'O/U')}
                                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all
                                                ${betSlip.some(b => b.matchId === match.id && b.selection.includes('Over'))
                                                  ? 'bg-brand/30 border border-brand text-brand' : 'bg-surface border border-border text-white hover:border-brand/50'}`}
                                            >
                                              Over <span className="text-brand ml-1">{match.markets.overUnder.over.toFixed(2)}</span>
                                            </button>
                                            <button
                                              onClick={() => toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, `Under ${match.markets.overUnder!.line}`, match.markets.overUnder!.under, 'O/U')}
                                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all
                                                ${betSlip.some(b => b.matchId === match.id && b.selection.includes('Under'))
                                                  ? 'bg-brand/30 border border-brand text-brand' : 'bg-surface border border-border text-white hover:border-brand/50'}`}
                                            >
                                              Under <span className="text-brand ml-1">{match.markets.overUnder.under.toFixed(2)}</span>
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* BTTS */}
                                      {match.markets.bothTeamsScore && (
                                        <div className="bg-surface/60 rounded-lg p-3 border border-border">
                                          <div className="text-[10px] text-muted mb-2 font-semibold">Both Teams to Score</div>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, 'BTTS Yes', match.markets.bothTeamsScore!.yes, 'BTTS')}
                                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all
                                                ${betSlip.some(b => b.matchId === match.id && b.selection === 'BTTS Yes')
                                                  ? 'bg-brand/30 border border-brand text-brand' : 'bg-surface border border-border text-white hover:border-brand/50'}`}
                                            >
                                              Yes <span className="text-brand ml-1">{match.markets.bothTeamsScore.yes.toFixed(2)}</span>
                                            </button>
                                            <button
                                              onClick={() => toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, 'BTTS No', match.markets.bothTeamsScore!.no, 'BTTS')}
                                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all
                                                ${betSlip.some(b => b.matchId === match.id && b.selection === 'BTTS No')
                                                  ? 'bg-brand/30 border border-brand text-brand' : 'bg-surface border border-border text-white hover:border-brand/50'}`}
                                            >
                                              No <span className="text-brand ml-1">{match.markets.bothTeamsScore.no.toFixed(2)}</span>
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* Handicap */}
                                      {match.markets.handicap && (
                                        <div className="bg-surface/60 rounded-lg p-3 border border-border">
                                          <div className="text-[10px] text-muted mb-2 font-semibold">
                                            Asian Handicap ({match.markets.handicap.line})
                                          </div>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, `${match.homeTeam} ${match.markets.handicap!.line}`, match.markets.handicap!.home, 'HC')}
                                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all
                                                ${betSlip.some(b => b.matchId === match.id && b.selection.includes(match.homeTeam) && b.market === 'HC')
                                                  ? 'bg-brand/30 border border-brand text-brand' : 'bg-surface border border-border text-white hover:border-brand/50'}`}
                                            >
                                              {match.homeTeam.split(' ').pop()} <span className="text-brand ml-1">{match.markets.handicap.home.toFixed(2)}</span>
                                            </button>
                                            <button
                                              onClick={() => toggleBet(match.id, `${match.homeTeam} vs ${match.awayTeam}`, `${match.awayTeam} ${match.markets.handicap!.line === '-1.5' ? '+1.5' : '-1.5'}`, match.markets.handicap!.away, 'HC')}
                                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all
                                                ${betSlip.some(b => b.matchId === match.id && b.selection.includes(match.awayTeam) && b.market === 'HC')
                                                  ? 'bg-brand/30 border border-brand text-brand' : 'bg-surface border border-border text-white hover:border-brand/50'}`}
                                            >
                                              {match.awayTeam.split(' ').pop()} <span className="text-brand ml-1">{match.markets.handicap.away.toFixed(2)}</span>
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {filteredMatches.length === 0 && (
                <div className="text-center py-16 text-muted">
                  <Search size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No matches found</p>
                  <p className="text-xs mt-1">Try a different sport or filter</p>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Bet Slip */}
          <div className="hidden lg:block w-72 shrink-0">
            <BetSlipPanel
              betSlip={betSlip} stake={stake} setStake={setStake}
              onRemove={(key) => setBetSlip(prev => prev.filter(b => b.matchId + b.selection !== key))}
              onClear={() => setBetSlip([])}
              onPlace={placeBet}
              balance={balance}
            />
          </div>
        </div>
      </div>

      {/* Mobile Bet Slip FAB */}
      {betSlip.length > 0 && (
        <div className="lg:hidden fixed bottom-20 right-4 z-50">
          <button onClick={() => setShowMobileBetSlip(true)}
            className="bg-brand text-black w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-brand/40 relative"
          >
            <Zap size={20} />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {betSlip.length}
            </span>
          </button>
        </div>
      )}

      {/* Mobile Bet Slip Modal */}
      <AnimatePresence>
        {showMobileBetSlip && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/80 z-50 flex items-end"
            onClick={() => setShowMobileBetSlip(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="w-full max-h-[80vh] overflow-y-auto bg-surface rounded-t-2xl p-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-3" />
              <BetSlipPanel
                betSlip={betSlip} stake={stake} setStake={setStake}
                onRemove={(key) => setBetSlip(prev => prev.filter(b => b.matchId + b.selection !== key))}
                onClear={() => setBetSlip([])}
                onPlace={() => { placeBet(); setShowMobileBetSlip(false) }}
                balance={balance}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <MobileNav />
    </div>
  )
}
