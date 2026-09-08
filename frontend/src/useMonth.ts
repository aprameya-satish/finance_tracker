import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from './api'

export function useMonth() {
  const [params] = useSearchParams()
  const fromUrl = params.get('month')
  const { data } = useQuery({
    queryKey: ['latest-month'],
    queryFn: () => api.get<{ year_month: string }>('/api/reports/latest-month'),
    enabled: !fromUrl,
  })
  return fromUrl || data?.year_month || new Date().toISOString().slice(0, 7)
}

export function useIncludePending() {
  const [params, setParams] = useSearchParams()
  const includePending = params.get('pending') === '1'
  const setIncludePending = (next: boolean) => {
    const copy = new URLSearchParams(params)
    if (next) copy.set('pending', '1')
    else copy.delete('pending')
    setParams(copy)
  }
  return [includePending, setIncludePending] as const
}

export function pendingQuery(includePending: boolean) {
  return includePending ? 'include_pending=true' : ''
}
