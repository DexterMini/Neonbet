const API = process.env.NEXT_PUBLIC_API_URL || ''

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('celora_token')
}

function setToken(token: string) {
  localStorage.setItem('celora_token', token)
}

function clearToken() {
  localStorage.removeItem('celora_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${API}${path}`, { ...options, headers })
  if (res.status === 401) {
    clearToken()
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || body.message || res.statusText)
  }
  if (res.status === 204) return {} as T
  return res.json()
}

// ── Auth ──
export async function login(username: string, password: string) {
  const data = await request<{ token: string; user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setToken(data.token)
  return data
}

export async function register(username: string, email: string, password: string) {
  const data = await request<{ token: string; user: any }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })
  setToken(data.token)
  return data
}

export async function getMe() {
  return request<any>('/auth/me')
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' })
  } finally {
    clearToken()
  }
}

// ── Wallet ──
export async function getBalances() {
  return request<Record<string, number>>('/wallet/balances')
}

export async function getTransactions(limit = 50, offset = 0) {
  return request<any[]>(`/wallet/transactions?limit=${limit}&offset=${offset}`)
}

export async function requestWithdraw(currency: string, amount: number, address: string) {
  return request<any>('/wallet/withdraw', {
    method: 'POST',
    body: JSON.stringify({ currency, amount, address }),
  })
}

// ── Bets ──
export async function placeBet(gameType: string, betAmount: number, params: Record<string, any> = {}, idempotencyKey?: string) {
  const headers: Record<string, string> = {}
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  return request<any>('/bets/place', {
    method: 'POST',
    headers,
    body: JSON.stringify({ game_type: gameType, bet_amount: betAmount, params }),
  })
}

export async function getBetHistory(limit = 50, offset = 0) {
  return request<any[]>(`/bets/history?limit=${limit}&offset=${offset}`)
}

export async function getBetStats() {
  return request<any>('/bets/stats/summary')
}

// ── Leaderboard ──
export async function getLeaderboard(period = 'daily', sort = 'wagered', limit = 20) {
  return request<any[]>(`/leaderboard/top?period=${period}&sort=${sort}&limit=${limit}`)
}

// ── Admin ──
export async function checkAdmin() {
  return request<{ is_admin: boolean }>('/admin/check-admin')
}

export async function getAdminStatsOverview() {
  return request<any>('/admin/stats/overview')
}

export async function getAdminStatsGames() {
  return request<any[]>('/admin/stats/games')
}

export async function getAdminStatsRevenue() {
  return request<any>('/admin/stats/revenue')
}

export async function searchUsers(query?: string, status?: string, limit = 50) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (status) params.set('status', status)
  params.set('limit', String(limit))
  return request<any[]>(`/admin/users/search?${params}`)
}

export async function getUserDetail(userId: string) {
  return request<any>(`/admin/users/${userId}`)
}

export async function adminUserAction(userId: string, action: string, reason?: string) {
  return request<any>('/admin/users/action', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, action, reason }),
  })
}

export async function adminAdjustBalance(userId: string, currency: string, amount: number, reason: string) {
  return request<any>('/admin/users/adjust-balance', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, currency, amount, reason }),
  })
}

export async function getPendingWithdrawals() {
  return request<any[]>('/admin/withdrawals/pending')
}

export async function approveWithdrawal(withdrawalId: string) {
  return request<any>(`/admin/withdrawals/${withdrawalId}/approve`, { method: 'POST' })
}

export async function rejectWithdrawal(withdrawalId: string, reason: string) {
  return request<any>(`/admin/withdrawals/${withdrawalId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function getRiskAlerts() {
  return request<any[]>('/admin/risk/alerts')
}

export async function resolveRiskAlert(alertId: string, resolution: string) {
  return request<any>(`/admin/risk/alerts/${alertId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolution }),
  })
}

export async function getGameSettings() {
  return request<any[]>('/admin/games/settings')
}

export async function updateGameSettings(gameType: string, settings: Record<string, any>) {
  return request<any>(`/admin/games/settings/${gameType}`, {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

export async function getAuditLog(limit = 100) {
  return request<{ actions: any[]; total: number }>(`/admin/audit-log?limit=${limit}`)
}

export async function getSystemFreezeStatus() {
  return request<{ frozen: boolean }>('/admin/system/freeze-status')
}

export async function freezeSystem() {
  return request<any>('/admin/system/freeze', { method: 'POST' })
}

export async function unfreezeSystem() {
  return request<any>('/admin/system/unfreeze', { method: 'POST' })
}

export { getToken, setToken, clearToken }
