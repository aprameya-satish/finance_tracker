import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { loadLocalFinance } from './local'

type Ctx = {
  api: typeof api
  baseUrl: string
  ready: boolean
  setBaseUrl: (url: string) => Promise<void>
  month: string
  setMonth: (month: string) => void
  includePending: boolean
  setIncludePending: (value: boolean) => void
}

const AppContext = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [includePending, setIncludePending] = useState(false)
  const [queryClient] = useState(() => new QueryClient())

  useEffect(() => {
    loadLocalFinance()
      .then(() => api.get<{ year_month: string }>('/api/reports/latest-month'))
      .then((data) => setMonth(data.year_month))
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider
        value={{
          api,
          baseUrl: 'on-device',
          ready,
          setBaseUrl: async () => undefined,
          month,
          setMonth,
          includePending,
          setIncludePending,
        }}
      >
        {children}
      </AppContext.Provider>
    </QueryClientProvider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
