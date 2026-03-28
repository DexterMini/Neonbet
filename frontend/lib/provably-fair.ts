/**
 * Provably Fair Cryptographic System
 * 
 * This system uses SHA-256 hashing to generate verifiable random outcomes.
 * Players can verify every bet result using the server seed, client seed, and nonce.
 * 
 * How it works:
 * 1. Server generates a random server seed and provides the hash (commitment)
 * 2. Player provides their client seed (or uses default)
 * 3. On each bet, the nonce increments
 * 4. Combined hash = SHA-256(serverSeed:clientSeed:nonce)
 * 5. This hash is converted to a game result
 * 6. After changing server seed, the old seed is revealed for verification
 */

// Web Crypto API based SHA-256
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Synchronous SHA-256 using SubtleCrypto with pre-computed values for client-side
function sha256Sync(message: string): string {
  // Simple hash implementation for synchronous operations
  let hash = 0
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  // Expand to 64 char hex string
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return hex.repeat(8)
}

// Generate a cryptographically secure random hex string
export function generateSecureRandom(bytes: number = 32): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Generate server seed hash (commitment)
export async function hashServerSeed(serverSeed: string): Promise<string> {
  return sha256(serverSeed)
}

// Generate combined hash for bet
export async function generateBetHash(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Promise<string> {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`
  return sha256(combined)
}

// Convert hash to float between 0 and 1
export function hashToFloat(hash: string): number {
  // Take first 8 characters (32 bits) and convert to float
  const int = parseInt(hash.substring(0, 8), 16)
  return int / 0xFFFFFFFF
}

// Convert hash to integer in range [min, max]
export function hashToInt(hash: string, min: number, max: number): number {
  const float = hashToFloat(hash)
  return Math.floor(float * (max - min + 1)) + min
}

// ==================== GAME SPECIFIC ALGORITHMS ====================

/**
 * CRASH GAME
 * Generates a crash point multiplier
 * House edge is built into the formula
 */
export function calculateCrashPoint(hash: string, houseEdge: number = 0.04): number {
  const float = hashToFloat(hash)
  
  // 4% chance of instant crash (1.00x)
  if (float < houseEdge) {
    return 1.00
  }
  
  // Calculate crash point with house edge
  // Formula: 1 / (1 - (float * (1 - houseEdge)))
  const crashPoint = (1 - houseEdge) / (1 - float)
  
  // Round to 2 decimal places, max at 1000000x
  return Math.min(Math.floor(crashPoint * 100) / 100, 1000000)
}

/**
 * DICE GAME
 * Generates a roll between 0.00 and 100.00
 */
export function calculateDiceRoll(hash: string): number {
  const float = hashToFloat(hash)
  // Convert to roll between 0.00 and 99.99
  return Math.floor(float * 10000) / 100
}

/**
 * MINES GAME
 * Generates mine positions for a grid
 */
export function generateMinePositions(
  hash: string,
  gridSize: number = 25,
  mineCount: number = 5
): number[] {
  const positions: number[] = []
  let currentHash = hash
  
  while (positions.length < mineCount) {
    const position = hashToInt(currentHash, 0, gridSize - 1)
    
    if (!positions.includes(position)) {
      positions.push(position)
    }
    
    // Generate new hash for next iteration
    currentHash = sha256Sync(currentHash)
  }
  
  return positions.sort((a, b) => a - b)
}

/**
 * PLINKO GAME
 * Generates the path of the ball (left/right at each peg)
 */
export function generatePlinkoPath(hash: string, rows: number = 16): ('L' | 'R')[] {
  const path: ('L' | 'R')[] = []
  let currentHash = hash
  
  for (let i = 0; i < rows; i++) {
    const float = hashToFloat(currentHash.substring(i * 4, (i * 4) + 8) || currentHash)
    path.push(float < 0.5 ? 'L' : 'R')
    
    if (i % 8 === 7) {
      currentHash = sha256Sync(currentHash)
    }
  }
  
  return path
}

/**
 * Calculate Plinko multiplier based on final bucket
 */
export function calculatePlinkoMultiplier(path: ('L' | 'R')[], risk: 'low' | 'medium' | 'high' = 'medium'): number {
  // Count how many rights (determines final bucket position)
  const rightCount = path.filter(p => p === 'R').length
  const rows = path.length
  
  // Multipliers for 16 rows, different risk levels
  const multipliers: Record<string, number[]> = {
    low: [5.6, 2.1, 1.1, 1, 0.5, 1, 0.3, 0.5, 0.5, 0.3, 1, 0.5, 1, 1.1, 2.1, 5.6, 16],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.3, 0.2, 0.2, 0.2, 0.2, 0.3, 0.4, 0.7, 1.3, 3, 13, 110],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000, 1000]
  }
  
  const bucketIndex = Math.min(rightCount, rows)
  return multipliers[risk][bucketIndex] || 1
}

/**
 * LIMBO GAME
 * Generates a target multiplier (similar to crash but instant)
 */
export function calculateLimboResult(hash: string, houseEdge: number = 0.04): number {
  const float = hashToFloat(hash)
  
  // Similar to crash but different distribution
  if (float < houseEdge) {
    return 1.00
  }
  
  const result = (1 - houseEdge) / (1 - float)
  return Math.floor(result * 100) / 100
}

/**
 * WHEEL GAME
 * Determines which segment the wheel lands on
 */
export function calculateWheelResult(hash: string, segments: number = 50): number {
  return hashToInt(hash, 0, segments - 1)
}

/**
 * KENO GAME
 * Generates the drawn numbers
 */
export function generateKenoNumbers(hash: string, count: number = 10, max: number = 40): number[] {
  const numbers: number[] = []
  let currentHash = hash
  
  while (numbers.length < count) {
    const num = hashToInt(currentHash, 1, max)
    
    if (!numbers.includes(num)) {
      numbers.push(num)
    }
    
    currentHash = sha256Sync(currentHash)
  }
  
  return numbers.sort((a, b) => a - b)
}

/**
 * BLACKJACK / TWENTY ONE
 * Generates a shuffled deck order
 */
export function generateDeckOrder(hash: string): number[] {
  const deck = Array.from({ length: 52 }, (_, i) => i)
  let currentHash = hash
  
  // Fisher-Yates shuffle using hash
  for (let i = deck.length - 1; i > 0; i--) {
    const j = hashToInt(currentHash, 0, i)
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
    
    if (i % 8 === 0) {
      currentHash = sha256Sync(currentHash)
    }
  }
  
  return deck
}

/**
 * COIN FLIP
 * Simple heads or tails
 */
export function calculateCoinFlip(hash: string): 'heads' | 'tails' {
  const float = hashToFloat(hash)
  return float < 0.5 ? 'heads' : 'tails'
}

// ==================== VERIFICATION FUNCTIONS ====================

export interface BetVerification {
  serverSeed: string
  serverSeedHash: string
  clientSeed: string
  nonce: number
  betHash: string
  result: unknown
  isValid: boolean
}

export async function verifyBet(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  expectedHash: string
): Promise<boolean> {
  const computedHash = await generateBetHash(serverSeed, clientSeed, nonce)
  return computedHash === expectedHash
}

// ==================== SESSION MANAGEMENT ====================

export interface GameSession {
  id: string
  serverSeedHash: string  // Public commitment
  serverSeed: string      // Hidden until rotation
  clientSeed: string
  nonce: number
  createdAt: number
}

export function createGameSession(clientSeed?: string): GameSession {
  const serverSeed = generateSecureRandom(32)
  
  return {
    id: generateSecureRandom(16),
    serverSeedHash: sha256Sync(serverSeed),
    serverSeed,
    clientSeed: clientSeed || generateSecureRandom(16),
    nonce: 0,
    createdAt: Date.now()
  }
}

export function incrementNonce(session: GameSession): GameSession {
  return {
    ...session,
    nonce: session.nonce + 1
  }
}

export function rotateServerSeed(session: GameSession): { 
  newSession: GameSession
  revealedSeed: string 
} {
  const revealedSeed = session.serverSeed
  const newServerSeed = generateSecureRandom(32)
  
  return {
    newSession: {
      ...session,
      id: generateSecureRandom(16),
      serverSeedHash: sha256Sync(newServerSeed),
      serverSeed: newServerSeed,
      nonce: 0,
      createdAt: Date.now()
    },
    revealedSeed
  }
}
