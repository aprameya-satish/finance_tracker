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
