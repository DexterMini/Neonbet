'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, ReactNode } from 'react'
import { useAuthStore } from '@/stores/authStore'

function HydrationGate({ children }: { children: ReactNode }) {
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isHydrated) {
    return (
      <div className="min-h-screen bg-[#080b11] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationGate>{children}</HydrationGate>
    </QueryClientProvider>
  )
}
