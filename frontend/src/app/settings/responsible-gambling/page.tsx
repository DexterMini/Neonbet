'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Navbar } from '@/components/Navbar'
import { Sidebar } from '@/components/Sidebar'
import { ChatPanel } from '@/components/ChatPanel'
import { MobileNav } from '@/components/MobileNav'
import { Button, Input } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import {
  Shield, Clock, AlertTriangle, Ban, Snowflake,
  Save, ArrowLeft, CheckCircle
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Limits {
  daily_deposit_limit: number | null
  weekly_deposit_limit: number | null
  monthly_deposit_limit: number | null
  daily_loss_limit: number | null
  weekly_loss_limit: number | null
  monthly_loss_limit: number | null
  daily_wager_limit: number | null
  session_time_limit: number | null
  reality_check_interval: number | null
  self_excluded: boolean
  self_exclusion_until: string | null
  cool_off_until: string | null
}

export default function ResponsibleGamblingPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const token = useAuthStore(s => s.token)
  const user = useAuthStore(s => s.user)

  const [limits, setLimits] = useState<Limits>({
    daily_deposit_limit: null, weekly_deposit_limit: null, monthly_deposit_limit: null,
    daily_loss_limit: null, weekly_loss_limit: null, monthly_loss_limit: null,
    daily_wager_limit: null, session_time_limit: null, reality_check_interval: null,
    self_excluded: false, self_exclusion_until: null, cool_off_until: null,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Self-exclusion / cool-off
  const [excludeDays, setExcludeDays] = useState(30)
  const [coolOffHours, setCoolOffHours] = useState(24)
  const [confirmExclude, setConfirmExclude] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`${API}/api/v1/responsible-gambling/limits`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.daily_deposit_limit !== undefined) setLimits(data)
      })
      .catch(() => {})
  }, [token])

  const saveLimits = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`${API}/api/v1/responsible-gambling/limits`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          daily_deposit_limit: limits.daily_deposit_limit,
          weekly_deposit_limit: limits.weekly_deposit_limit,
          monthly_deposit_limit: limits.monthly_deposit_limit,
          daily_loss_limit: limits.daily_loss_limit,
          weekly_loss_limit: limits.weekly_loss_limit,
          monthly_loss_limit: limits.monthly_loss_limit,
          daily_wager_limit: limits.daily_wager_limit,
          session_time_limit: limits.session_time_limit,
          reality_check_interval: limits.reality_check_interval,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const selfExclude = async () => {
    if (!confirmExclude) {
      setConfirmExclude(true)
      return
    }
    try {
      const res = await fetch(`${API}/api/v1/responsible-gambling/self-exclude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ duration_days: excludeDays }),
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed')
      const data = await res.json()
      setLimits(prev => ({ ...prev, self_excluded: true, self_exclusion_until: data.excluded_until }))
      setConfirmExclude(false)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const coolOff = async () => {
    try {
      const res = await fetch(`${API}/api/v1/responsible-gambling/cool-off`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hours: coolOffHours }),
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed')
      const data = await res.json()
      setLimits(prev => ({ ...prev, cool_off_until: data.cool_off_until }))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const limitField = (
    label: string,
    key: keyof Limits,
    placeholder: string,
    suffix?: string,
  ) => (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <div className="relative">
        <Input
          type="number"
          min={0}
          value={(limits[key] as string | number) ?? ''}
          onChange={(e) => setLimits(prev => ({
            ...prev,
            [key]: e.target.value === '' ? null : Number(e.target.value),
          }))}
          placeholder={placeholder}
          className="pr-12"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{suffix}</span>
        )}
      </div>
    </div>
  )

  if (!user) {
    return (
      <div className="min-h-screen bg-background-deep flex items-center justify-center">
        <p className="text-gray-400">Please log in to access responsible gambling settings.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-deep">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[240px]">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <ChatPanel />
        <MobileNav />

        <div className="p-3 sm:p-5">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/5">
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center ring-1 ring-green-500/20">
                <Shield className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Responsible Gambling</h1>
                <p className="text-gray-500 text-xs">Set limits to stay in control</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">{error}</div>
            )}

            {/* Active restrictions banner */}
            {(limits.self_excluded || limits.cool_off_until) && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-1">
                  <AlertTriangle className="w-4 h-4" /> Active Restriction
                </div>
                {limits.self_excluded && (
                  <p className="text-xs text-gray-400">
                    Self-excluded until {limits.self_exclusion_until ? new Date(limits.self_exclusion_until).toLocaleDateString() : 'unknown'}
                  </p>
                )}
                {limits.cool_off_until && (
                  <p className="text-xs text-gray-400">
                    Cool-off active until {new Date(limits.cool_off_until).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Deposit Limits */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" /> Deposit Limits
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {limitField('Daily', 'daily_deposit_limit', 'No limit', 'USD')}
                {limitField('Weekly', 'weekly_deposit_limit', 'No limit', 'USD')}
                {limitField('Monthly', 'monthly_deposit_limit', 'No limit', 'USD')}
              </div>
            </div>

            {/* Loss Limits */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Loss Limits
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {limitField('Daily', 'daily_loss_limit', 'No limit', 'USD')}
                {limitField('Weekly', 'weekly_loss_limit', 'No limit', 'USD')}
                {limitField('Monthly', 'monthly_loss_limit', 'No limit', 'USD')}
              </div>
            </div>

            {/* Wager & Session Limits */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" /> Wager & Session Limits
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {limitField('Daily Wager', 'daily_wager_limit', 'No limit', 'USD')}
                {limitField('Session Time', 'session_time_limit', 'No limit', 'min')}
                {limitField('Reality Check', 'reality_check_interval', 'Off', 'min')}
              </div>
            </div>

            {/* Save */}
            <Button onClick={saveLimits} disabled={saving} className="w-full">
              {saving ? 'Saving...' : saved ? (
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Saved!</span>
              ) : (
                <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Save All Limits</span>
              )}
            </Button>

            {/* Cool-off */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-cyan-400" /> Take a Break (Cool-off)
              </h2>
              <p className="text-xs text-gray-500 mb-4">Temporarily pause your account. You won't be able to place bets during this period.</p>
              <div className="flex items-center gap-3">
                <select
                  value={coolOffHours}
                  onChange={e => setCoolOffHours(Number(e.target.value))}
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
                <Button onClick={coolOff} variant="outline" className="text-cyan-400 border-cyan-500/30">
                  Activate Cool-off
                </Button>
              </div>
            </div>

            {/* Self-Exclusion */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-400" /> Self-Exclusion
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                This will lock your account for the selected period. This action <strong className="text-red-400">cannot be reversed</strong>.
              </p>
              <div className="flex items-center gap-3">
                <select
                  value={excludeDays}
                  onChange={e => { setExcludeDays(Number(e.target.value)); setConfirmExclude(false) }}
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>6 months</option>
                  <option value={365}>1 year</option>
                </select>
                <Button
                  onClick={selfExclude}
                  className={confirmExclude ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}
                >
                  {confirmExclude ? 'Confirm Self-Exclusion' : 'Self-Exclude'}
                </Button>
              </div>
              {confirmExclude && (
                <p className="text-xs text-red-400 mt-2">
                  Click again to confirm. Your account will be locked for {excludeDays} days.
                </p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
