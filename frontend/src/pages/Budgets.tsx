import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, money, type BudgetRow, type Category } from '../api'
import MonthPicker from '../components/MonthPicker'
import PendingToggle from '../components/PendingToggle'
import { pendingQuery, useIncludePending, useMonth } from '../useMonth'

export default function Budgets() {
  const month = useMonth()
  const [params, setParams] = useSearchParams()
  const [includePending, setIncludePending] = useIncludePending()
  const pending = pendingQuery(includePending)
  const qc = useQueryClient()
  const { data: rows = [] } = useQuery({
    queryKey: ['budgets', month, includePending],
    queryFn: () => api.get<BudgetRow[]>(`/api/budgets/${month}${pending ? `?${pending}` : ''}`),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/categories'),
  })
  const upsert = useMutation({
    mutationFn: (body: { year_month: string; category_id: number; limit_cents: number }) =>
      api.put('/api/budgets', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['report'] })
    },
  })
  const copy = useMutation({
    mutationFn: () => {
      const [y, m] = month.split('-').map(Number)
      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
      return api.post('/api/budgets/copy', { from_month: prev, to_month: month })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
  const [newCat, setNewCat] = useState('')
  const [newLimit, setNewLimit] = useState('')

  return (
    <div>
      <header className="flex items-end justify-between mb-8">
        <div>
          <div className="text-[var(--muted)] text-sm mb-1">Household</div>
          <h1 className="text-3xl tracking-tight">Budgets</h1>
        </div>
        <div className="flex gap-3">
          <button className="text-sm text-[var(--muted)]" onClick={() => copy.mutate()}>
            Copy previous month
          </button>
          <PendingToggle checked={includePending} onChange={setIncludePending} />
          <MonthPicker
            value={month}
            onChange={(m) => {
              const next = new URLSearchParams(params)
              next.set('month', m)
              setParams(next)
            }}
          />
        </div>
      </header>

      <div className="flex gap-3 mb-6">
        <select value={newCat} onChange={(e) => setNewCat(e.target.value)}>
          <option value="">Add category limit</option>
          {categories.filter((c) => c.include_in_budget).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input placeholder="Limit USD" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} />
        <button
          className="rounded-lg bg-white text-black px-4 text-sm"
          onClick={() => {
            if (!newCat || !newLimit) return
            upsert.mutate({
              year_month: month,
              category_id: Number(newCat),
              limit_cents: Math.round(Number(newLimit) * 100),
            })
            setNewLimit('')
          }}
        >
          Save
        </button>
      </div>

      <div className="space-y-4">
        {rows
          .filter((r) => r.limit_cents > 0 || r.status === 'over' || r.status === 'unbudgeted')
          .map((row) => {
            const pct = row.limit_cents ? Math.min(100, (row.spent_cents / row.limit_cents) * 100) : 0
            return (
              <div key={row.category_id} className="border border-[var(--border)] rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <div>{row.category}</div>
                  <div className="tabular text-sm">
                    {money(row.spent_cents)}
                    {row.limit_cents ? ` / ${money(row.limit_cents)}` : ' unbudgeted'}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: row.status === 'over' ? 'var(--red)' : row.status === 'watch' ? 'var(--amber)' : 'var(--green)',
                    }}
                  />
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
