'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, Sparkles, ArrowRight, Shield, Zap, Award } from 'lucide-react'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(emailOrUsername, password)
      router.push('/')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — Branding panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-background-secondary relative overflow-hidden flex-col justify-between p-12 border-r border-border">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/[0.04] rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand/[0.03] rounded-full blur-[120px]" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center shadow-glow-gold-sm">
              <Sparkles className="w-4 h-4 text-background-deep" />
            </div>
            <span className="font-bold text-white tracking-tight text-lg">NeonBet</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-hero text-white leading-[1.1] tracking-tight">
              Play with<br />
              <span className="text-gradient-gold">confidence.</span>
            </h1>
            <p className="text-body text-muted-light mt-4 max-w-md leading-relaxed">
              Every game is provably fair. Every payout is instant.
              Join thousands of players who trust NeonBet.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: Shield, title: 'Provably Fair', desc: 'Every outcome is verifiable' },
              { icon: Zap, title: 'Instant Payouts', desc: 'Withdraw in seconds, not days' },
              { icon: Award, title: 'VIP Rewards', desc: 'Earn up to 35% rakeback' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]"
              >
                <div className="w-10 h-10 rounded-lg bg-brand/[0.08] flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <p className="text-small font-medium text-white">{item.title}</p>
                  <p className="text-tiny text-muted">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-8">
          {[
            { value: '$50M+', label: 'Total Paid Out' },
            { value: '100K+', label: 'Active Players' },
            { value: '24/7', label: 'Support' },
          ].map((stat, i) => (
            <div key={i} className="flex items-center gap-8">
              <div>
                <p className="text-h3 text-white font-bold">{stat.value}</p>
                <p className="text-tiny text-muted">{stat.label}</p>
              </div>
              {i < 2 && <div className="w-px h-10 bg-border" />}
            </div>
          ))}
        </div>
      </div>

      {/* Right — Form */}
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
            <h2 className="text-h1 text-white">Welcome back</h2>
            <p className="text-body text-muted mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-3.5 bg-accent-red/[0.06] border border-accent-red/20 rounded-xl text-accent-red text-small">
                {error}
              </div>
            )}

            <Input
              label="Email or Username"
              type="text"
              value={emailOrUsername}
              onChange={e => setEmailOrUsername(e.target.value)}
              placeholder="you@example.com"
              icon={<Mail className="h-4 w-4" />}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              icon={<Lock className="h-4 w-4" />}
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded bg-background-elevated border-border text-brand focus:ring-brand/30 focus:ring-offset-0"
                />
                <span className="text-small text-muted-light">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-small text-brand hover:text-brand-light transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full h-12"
              size="lg"
            >
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-background text-tiny text-muted">or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="secondary" size="md" className="w-full hover:bg-surface-light transition-all">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </Button>
              <Button variant="secondary" size="md" className="w-full hover:bg-surface-light transition-all">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
                GitHub
              </Button>
            </div>
          </div>

          <p className="mt-8 text-center text-small text-muted">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand font-semibold hover:text-brand-light transition-colors">
              Create account
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
