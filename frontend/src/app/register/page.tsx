'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, User, ArrowRight, Sparkles, Shield, Zap, Award } from 'lucide-react'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)

  const passwordStrength = () => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!acceptTerms) {
      setError('Please accept the terms and conditions')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (passwordStrength() < 2) {
      setError('Password is too weak')
      return
    }

    setLoading(true)
    try {
      await useAuthStore.getState().register(username, email, password)
      router.push('/')
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const strength = passwordStrength()
  const strengthLabel = strength <= 1 ? 'Weak' : strength <= 2 ? 'Fair' : strength <= 3 ? 'Good' : 'Strong'
  const strengthColor = strength <= 1 ? 'bg-accent-red' : strength <= 2 ? 'bg-accent-amber' : strength <= 3 ? 'bg-brand' : 'bg-accent-green'

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center shadow-glow-gold-sm">
                <Sparkles className="w-5 h-5 text-background-deep" />
              </div>
              <span className="text-white font-bold text-xl">NeonBet</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-h1 text-white">Create account</h2>
            <p className="text-body text-muted mt-1">Start your journey today</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-accent-red/[0.06] border border-accent-red/20 rounded-xl text-accent-red text-small">
                {error}
              </div>
            )}

            <Input
              label="Username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Choose a username"
              icon={<User className="h-4 w-4" />}
              required
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              icon={<Mail className="h-4 w-4" />}
              required
            />

            <div className="space-y-1.5">
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Create a strong password"
                icon={<Lock className="h-4 w-4" />}
                required
              />
              {password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-colors',
                          i <= strength ? strengthColor : 'bg-border-light'
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-2xs text-muted">{strengthLabel}</p>
                </div>
              )}
            </div>

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              icon={<Lock className="h-4 w-4" />}
              success={!!(confirmPassword && confirmPassword === password)}
              error={confirmPassword && confirmPassword !== password ? 'Passwords do not match' : undefined}
              required
            />

            <div className="flex items-start gap-3 pt-1">
              <input
                type="checkbox"
                id="terms"
                checked={acceptTerms}
                onChange={e => setAcceptTerms(e.target.checked)}
                className="w-4 h-4 rounded bg-background-elevated border-border text-brand focus:ring-brand/30 focus:ring-offset-0 mt-0.5"
              />
              <label htmlFor="terms" className="text-small text-muted-light leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" className="text-brand hover:text-brand-light transition-colors">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-brand hover:text-brand-light transition-colors">Privacy Policy</Link>
              </label>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full h-12 mt-2"
              size="lg"
            >
              {loading ? 'Creating account...' : 'Create Account'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          <p className="mt-8 text-center text-small text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-brand font-semibold hover:text-brand-light transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right — Branding panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-background-secondary relative overflow-hidden flex-col justify-between p-12 border-l border-border">
        {/* Ambient glow */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand/[0.04] rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-brand/[0.03] rounded-full blur-[120px]" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center shadow-glow-gold-sm">
              <Sparkles className="w-4 h-4 text-background-deep" />
            </div>
            <span className="font-bold text-white tracking-tight text-lg">NeonBet</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-6">
            {[
              { icon: Shield, title: 'Provably Fair', desc: 'Every outcome is cryptographically verifiable' },
              { icon: Zap, title: 'Instant Payouts', desc: 'Withdraw your winnings in seconds' },
              { icon: Award, title: 'VIP Rewards', desc: 'Earn up to 35% rakeback and exclusive bonuses' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]"
              >
                <div className="w-10 h-10 rounded-lg bg-brand/[0.08] flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <p className="text-small font-medium text-white">{feature.title}</p>
                  <p className="text-tiny text-muted">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-small text-muted">
            Join 100,000+ players worldwide
          </p>
        </div>
      </div>
    </div>
  )
}
