import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, money, type Account, type Category, type Transaction } from '../api'
import MonthPicker from '../components/MonthPicker'
import WhoControl from '../components/WhoControl'
import { useMonth } from '../useMonth'

function txnQuery(
  month: string,
  who: string,
  q: string,
  accountId: string,
  categoryId: string,
  review = false,
) {
  const p = new URLSearchParams()
  if (month) p.set('year_month', month)
  if (who) p.set('who', who)
  if (q) p.set('q', q)
  if (accountId) p.set('account_id', accountId)
  if (categoryId) p.set('category_id', categoryId)
  if (review) p.set('review', 'true')
  return `/api/transactions?${p}`
}

export default function TransactionsPage({ reviewOnly = false }: { reviewOnly?: boolean }) {
  const month = useMonth()
  const [params, setParams] = useSearchParams()
  const who = params.get('who') || ''
  const [q, setQ] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const qc = useQueryClient()
  const { data: rows = [] } = useQuery({
    queryKey: ['txns', month, who, q, accountId, categoryId, reviewOnly],
    queryFn: () => api.get<Transaction[]>(txnQuery(month, who, q, accountId, categoryId, reviewOnly)),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/categories'),
  })
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/api/accounts'),
  })
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.patch(`/api/transactions/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['txns'] })
      qc.invalidateQueries({ queryKey: ['report'] })
    },
  })
  const [selected, setSelected] = useState<number[]>([])

  const bulk = useMutation({
    mutationFn: (whoVal: string) =>
      api.post('/api/transactions/bulk-who', { ids: selected, who: whoVal, update_merchant_rule: true }),
    onSuccess: () => {
      setSelected([])
      qc.invalidateQueries({ queryKey: ['txns'] })
      qc.invalidateQueries({ queryKey: ['report'] })
    },
  })

  return (
    <div>
      <header className="flex items-end justify-between mb-8">
        <div>
          <div className="text-[var(--muted)] text-sm mb-1">{reviewOnly ? 'Needs a look' : 'Activity'}</div>
          <h1 className="text-3xl tracking-tight">{reviewOnly ? 'Review queue' : 'Transactions'}</h1>
        </div>
        <MonthPicker
          value={month}
          onChange={(m) => {
            const next = new URLSearchParams(params)
            next.set('month', m)
            setParams(next)
          }}
        />
      </header>

      <div className="flex flex-wrap gap-3 mb-6">
        <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={who} onChange={(e) => {
          const next = new URLSearchParams(params)
          if (e.target.value) next.set('who', e.target.value)
          else next.delete('who')
          setParams(next)
        }}>
          <option value="">All people</option>
          <option value="A">A</option>
          <option value="S">S</option>
          <option value="shared">Shared</option>
        </select>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {selected.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            {selected.length} selected
            <WhoControl value="" onChange={(w) => bulk.mutate(w)} />
          </div>
        )}
      </div>

      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[var(--muted)] text-left text-xs uppercase tracking-wider">
            <tr className="border-b border-[var(--border)]">
              <th className="p-3 w-8"></th>
              <th className="p-3">Date</th>
              <th className="p-3">Description</th>
              <th className="p-3">Category</th>
              <th className="p-3">Who</th>
              <th className="p-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    onChange={(e) =>
                      setSelected((s) => (e.target.checked ? [...s, t.id] : s.filter((id) => id !== t.id)))
                    }
                  />
                </td>
                <td className="p-3 tabular text-[var(--muted)] whitespace-nowrap">{t.date}</td>
                <td className="p-3">
                  <div>{t.description}</div>
                  <div className="text-xs text-[var(--muted)]">{t.account_name} · {t.txn_kind}{t.pending ? ' · pending' : ''}</div>
                </td>
                <td className="p-3">
                  <select
                    value={t.category_id ?? ''}
                    onChange={(e) =>
                      patch.mutate({
                        id: t.id,
                        body: { category_id: Number(e.target.value), update_merchant_rule: true },
                      })
                    }
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {t.category_confidence != null && t.category_source !== 'user' && (
                    <div className="text-[10px] text-[var(--muted)] mt-1">{t.category_source} {(t.category_confidence * 100).toFixed(0)}%</div>
                  )}
                </td>
                <td className="p-3">
                  <WhoControl
                    value={t.who}
                    onChange={(w) => patch.mutate({ id: t.id, body: { who: w, update_merchant_rule: false } })}
                  />
                </td>
                <td className={`p-3 text-right tabular ${t.amount_cents < 0 ? 'text-[var(--green)]' : ''}`}>
                  {money(t.amount_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-8 text-[var(--muted)]">No transactions in this view.</div>}
      </div>
    </div>
  )
}
