/**
 * Provably Fair System
 * 
 * This implements a cryptographically verifiable random number generation system.
 * 
 * How it works:
 * 1. Server generates a random seed and hashes it (SHA-256)
 * 2. Player is shown the HASH of the server seed BEFORE betting
 * 3. Player can set their own client seed
 * 4. The result is generated using HMAC-SHA256(serverSeed, clientSeed:nonce)
 * 5. After the bet, server reveals the original server seed
 * 6. Player can verify: SHA256(serverSeed) === previouslyShownHash
 * 7. Player can recalculate the result to verify fairness
 */

// Generate a cryptographically secure random hex string
export function generateRandomSeed(length: number = 64): string {
  const array = new Uint8Array(length / 2)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// SHA-256 hash function
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// HMAC-SHA256 for generating game results
export async function hmacSha256(key: string, message: string): Promise<string> {
  if (!key) throw new Error('HMAC key must not be empty — provably fair system not initialized yet')
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const msgData = encoder.encode(message)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Convert hex to a float between 0 and 1
export function hexToFloat(hex: string): number {
  // Use first 8 characters (32 bits) of hex
  const int = parseInt(hex.substring(0, 8), 16)
  // Divide by max 32-bit value to get float 0-1
  return int / 0xFFFFFFFF
}

// Generate a provably fair result
export async function generateResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Promise<{ hash: string; float: number }> {
  const combinedSeed = `${clientSeed}:${nonce}`
  const hash = await hmacSha256(serverSeed, combinedSeed)
  const float = hexToFloat(hash)
  return { hash, float }
}

// Verify a bet result
export async function verifyBet(
  serverSeed: string,
  serverSeedHash: string,
  clientSeed: string,
  nonce: number
): Promise<{ valid: boolean; result: number; calculatedHash: string }> {
  // First verify the server seed matches its hash
  const calculatedHash = await sha256(serverSeed)
  const valid = calculatedHash === serverSeedHash
  
  // Calculate the result
  const { float } = await generateResult(serverSeed, clientSeed, nonce)
  
  return {
    valid,
    result: float,
    calculatedHash
  }
}

// Game-specific result generators

// Dice: Returns number 0-100
export async function generateDiceResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Promise<number> {
  const { float } = await generateResult(serverSeed, clientSeed, nonce)
  return parseFloat((float * 100).toFixed(2))
}

// Crash: Returns multiplier (1.00x to potentially infinite)
export async function generateCrashResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Promise<number> {
  const { hash } = await generateResult(serverSeed, clientSeed, nonce)
  
  // Use first 52 bits for better distribution
  const h = parseInt(hash.substring(0, 13), 16)
  const e = Math.pow(2, 52)
  
  // House edge of 1%
  const houseEdge = 0.99
  
  // Calculate crash point
  const result = Math.floor((houseEdge * e) / (e - h))
  return Math.max(1, result / 100)
}

// Mines: Returns array of mine positions
export async function generateMinesResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  gridSize: number,
  mineCount: number
): Promise<number[]> {
  const mines: number[] = []
  let currentNonce = nonce
  
  while (mines.length < mineCount) {
    const { float } = await generateResult(serverSeed, clientSeed, currentNonce)
    const position = Math.floor(float * gridSize)
    
    if (!mines.includes(position)) {
      mines.push(position)
    }
    currentNonce++
  }
  
  return mines.sort((a, b) => a - b)
}

// Plinko: Returns array of directions (0 = left, 1 = right) for each row
export async function generatePlinkoResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: number
): Promise<number[]> {
  const directions: number[] = []
  
  for (let i = 0; i < rows; i++) {
    const { float } = await generateResult(serverSeed, clientSeed, nonce + i)
    directions.push(float < 0.5 ? 0 : 1)
  }
  
  return directions
}

// Limbo: Returns target multiplier
export async function generateLimboResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Promise<number> {
  const { float } = await generateResult(serverSeed, clientSeed, nonce)
  
  // House edge 1%
  const houseEdge = 0.99
  
  // Generate multiplier with exponential distribution
  const result = houseEdge / (1 - float)
  return Math.max(1, parseFloat(result.toFixed(2)))
}

// Wheel: Returns segment index
export async function generateWheelResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  segments: number
): Promise<number> {
  const { float } = await generateResult(serverSeed, clientSeed, nonce)
  return Math.floor(float * segments)
}

// Keno: Returns array of drawn numbers
export async function generateKenoResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  totalNumbers: number = 40,
  drawCount: number = 10
): Promise<number[]> {
  const drawn: number[] = []
  let currentNonce = nonce
  
  while (drawn.length < drawCount) {
    const { float } = await generateResult(serverSeed, clientSeed, currentNonce)
    const number = Math.floor(float * totalNumbers) + 1
    
    if (!drawn.includes(number)) {
      drawn.push(number)
    }
    currentNonce++
  }
  
  return drawn.sort((a, b) => a - b)
}

// Twenty One / Blackjack: Returns shuffled deck positions
export async function generateTwentyOneResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cardCount: number
): Promise<number[]> {
  const cards: number[] = []
  let currentNonce = nonce
  const deckSize = 52
  
  while (cards.length < cardCount) {
    const { float } = await generateResult(serverSeed, clientSeed, currentNonce)
    const card = Math.floor(float * deckSize)
    cards.push(card)
    currentNonce++
  }
  
  return cards
}

// Seed management class
export class ProvablyFairState {
  serverSeed: string = ''
  serverSeedHash: string = ''
  clientSeed: string = ''
  nonce: number = 0
  previousServerSeed: string = ''
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.loadState()
    }
  }
  
  private loadState() {
    const saved = localStorage.getItem('provablyFairState')
    if (saved) {
      const state = JSON.parse(saved)
      this.serverSeed = state.serverSeed || ''
      this.serverSeedHash = state.serverSeedHash || ''
      this.clientSeed = state.clientSeed || this.generateDefaultClientSeed()
      this.nonce = state.nonce || 0
      this.previousServerSeed = state.previousServerSeed || ''
    } else {
      this.clientSeed = this.generateDefaultClientSeed()
    }
  }
  
  private saveState() {
    localStorage.setItem('provablyFairState', JSON.stringify({
      serverSeed: this.serverSeed,
      serverSeedHash: this.serverSeedHash,
      clientSeed: this.clientSeed,
      nonce: this.nonce,
      previousServerSeed: this.previousServerSeed
    }))
  }
  
  private generateDefaultClientSeed(): string {
    return generateRandomSeed(32)
  }
  
  async initialize() {
    // Generate new server seed
    this.previousServerSeed = this.serverSeed
    this.serverSeed = generateRandomSeed(64)
    this.serverSeedHash = await sha256(this.serverSeed)
    this.nonce = 0
    this.saveState()
  }
  
  async rotateServerSeed(): Promise<{ previousSeed: string; newHash: string }> {
    const previousSeed = this.serverSeed
    await this.initialize()
    return {
      previousSeed,
      newHash: this.serverSeedHash
    }
  }
  
  setClientSeed(seed: string) {
    this.clientSeed = seed
    this.saveState()
  }
  
  incrementNonce() {
    this.nonce++
    this.saveState()
  }
  
  getState() {
    return {
      serverSeedHash: this.serverSeedHash,
      clientSeed: this.clientSeed,
      nonce: this.nonce,
      previousServerSeed: this.previousServerSeed
    }
  }
}

// Create singleton instance
let provablyFairInstance: ProvablyFairState | null = null

export function getProvablyFair(): ProvablyFairState {
  if (!provablyFairInstance) {
    provablyFairInstance = new ProvablyFairState()
  }
  return provablyFairInstance
}
