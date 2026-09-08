import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

type Summary = { as_of: string | null; value_cents: number; holdings: unknown[] }

export default function Investments() {
  const { data } = useQuery({
    queryKey: ['investments'],
    queryFn: () => api.get<Summary>('/api/investments/summary'),
  })
  return (
    <div>
      <header className="mb-8">
        <div className="text-[var(--muted)] text-sm mb-1">Next step</div>
        <h1 className="text-3xl tracking-tight">Investments</h1>
      </header>
      <div className="rounded-2xl border border-[var(--border)] p-10 max-w-xl">
        <div className="text-5xl tabular mb-4">
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((data?.value_cents || 0) / 100)}
        </div>
        <p className="text-[var(--muted)] leading-relaxed">
          Holdings will appear here after brokerage accounts are linked. Cash contributions (for example Robinhood
          debits) already live on the spending ledger as investment transfers and stay out of category budgets.
        </p>
      </div>
    </div>
  )
}
