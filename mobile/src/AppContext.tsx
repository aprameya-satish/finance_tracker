import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createApi, loadApiBaseUrl, saveApiBaseUrl, suggestedApiBaseUrl, type ApiClient } from './api'

type Ctx = {
  api: ApiClient
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
  const [baseUrl, setBaseUrlState] = useState(suggestedApiBaseUrl())
  const [ready, setReady] = useState(false)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [includePending, setIncludePending] = useState(false)
  const [queryClient] = useState(() => new QueryClient())
  const api = useMemo(() => createApi(baseUrl), [baseUrl])

  useEffect(() => {
    loadApiBaseUrl().then((url) => {
      setBaseUrlState(url)
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    api
      .get<{ year_month: string }>('/api/reports/latest-month')
      .then((data) => setMonth(data.year_month))
      .catch(() => undefined)
  }, [api, ready])

  const setBaseUrl = async (url: string) => {
    const cleaned = url.trim().replace(/\/$/, '')
    await saveApiBaseUrl(cleaned)
    setBaseUrlState(cleaned)
    queryClient.clear()
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider
        value={{ api, baseUrl, ready, setBaseUrl, month, setMonth, includePending, setIncludePending }}
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
