'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ProvablyFairState,
  getProvablyFair,
  generateRandomSeed,
  sha256,
  generateResult,
  generateDiceResult,
  generateCrashResult,
  generateMinesResult,
  generatePlinkoResult,
  generateLimboResult,
  generateWheelResult,
  generateKenoResult,
  generateTwentyOneResult
} from '@/lib/provablyFair'

export function useProvablyFair() {
  const [state, setState] = useState({
    serverSeed: '',
    serverSeedHash: '',
    clientSeed: '',
    nonce: 0,
    previousServerSeed: ''
  })
  const [initialized, setInitialized] = useState(false)

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      const pf = getProvablyFair()
      
      // If no server seed or hash, initialize fresh
      if (!pf.serverSeedHash || !pf.serverSeed) {
        await pf.initialize()
      }
      
      setState({
        serverSeed: pf.serverSeed,
        serverSeedHash: pf.serverSeedHash,
        clientSeed: pf.clientSeed,
        nonce: pf.nonce,
        previousServerSeed: pf.previousServerSeed
      })
      setInitialized(true)
    }
    
    init()
  }, [])

  // Generate a bet result
  const generateBet = useCallback(async (game: string, params?: any) => {
    const pf = getProvablyFair()
    const currentNonce = pf.nonce
    
    let result: any
    
    switch (game) {
      case 'dice':
        result = await generateDiceResult(pf.serverSeed, pf.clientSeed, currentNonce)
        break
      case 'crash':
        result = await generateCrashResult(pf.serverSeed, pf.clientSeed, currentNonce)
        break
      case 'mines':
        result = await generateMinesResult(
          pf.serverSeed, 
          pf.clientSeed, 
          currentNonce,
          params?.gridSize || 25,
          params?.mineCount || 3
        )
        break
      case 'plinko':
        result = await generatePlinkoResult(
          pf.serverSeed,
          pf.clientSeed,
          currentNonce,
          params?.rows || 16
        )
        break
      case 'limbo':
        result = await generateLimboResult(pf.serverSeed, pf.clientSeed, currentNonce)
        break
      case 'wheel':
        result = await generateWheelResult(
          pf.serverSeed,
          pf.clientSeed,
          currentNonce,
          params?.segments || 50
        )
        break
      case 'keno':
        result = await generateKenoResult(
          pf.serverSeed,
          pf.clientSeed,
          currentNonce,
          params?.totalNumbers || 40,
          params?.drawCount || 10
        )
        break
      case 'twentyone':
        result = await generateTwentyOneResult(
          pf.serverSeed,
          pf.clientSeed,
          currentNonce,
          params?.cardCount || 10
        )
        break
      case 'coinclimber':
      case 'chicken': {
        const { hash } = await generateResult(pf.serverSeed, pf.clientSeed, currentNonce + (params?.level || params?.row || 0))
        result = parseInt(hash.substring(0, 8), 16)
        break
      }
      case 'snake': {
        const { float } = await generateResult(pf.serverSeed, pf.clientSeed, currentNonce)
        result = float
        break
      }
      default:
        throw new Error(`Unknown game: ${game}`)
    }
    
    // Increment nonce after bet
    pf.incrementNonce()
    
    // Update state
    setState(prev => ({
      ...prev,
      nonce: pf.nonce
    }))
    
    return {
      result,
      nonce: currentNonce,
      clientSeed: pf.clientSeed,
      serverSeedHash: pf.serverSeedHash
    }
  }, [])

  // Rotate server seed (reveals old, generates new)
  const rotateSeed = useCallback(async () => {
    const pf = getProvablyFair()
    const { previousSeed, newHash } = await pf.rotateServerSeed()
    
    setState({
      serverSeed: pf.serverSeed,
      serverSeedHash: newHash,
      clientSeed: pf.clientSeed,
      nonce: 0,
      previousServerSeed: previousSeed
    })
    
    return { previousSeed, newHash }
  }, [])

  // Set client seed
  const setClientSeed = useCallback((seed: string) => {
    const pf = getProvablyFair()
    pf.setClientSeed(seed)
    setState(prev => ({
      ...prev,
      clientSeed: seed
    }))
  }, [])

  return {
    initialized,
    serverSeedHash: state.serverSeedHash,
    clientSeed: state.clientSeed,
    nonce: state.nonce,
    previousServerSeed: state.previousServerSeed,
    generateBet,
    rotateSeed,
    setClientSeed
  }
}
