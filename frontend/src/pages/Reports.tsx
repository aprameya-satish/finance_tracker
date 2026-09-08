import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, money, type MonthReport, type Settings, type Transaction } from '../api'
import MonthPicker from '../components/MonthPicker'
import PendingToggle from '../components/PendingToggle'
import SpendCharts from '../components/SpendCharts'
import WhoControl from '../components/WhoControl'
import { downloadMonthPdf, type MonthSeries } from '../reportExport'
import { pendingQuery, useIncludePending, useMonth } from '../useMonth'

export default function Reports() {
  const month = useMonth()
  const [params, setParams] = useSearchParams()
  const [includePending, setIncludePending] = useIncludePending()
  const pending = pendingQuery(includePending)
  const qc = useQueryClient()
  const [pdfBusy, setPdfBusy] = useState(false)
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/api/settings'),
  })
  const { data: report } = useQuery({
    queryKey: ['report', month, includePending],
    queryFn: () => api.get<MonthReport>(`/api/reports/month/${month}${pending ? `?${pending}` : ''}`),
  })
  const { data: series } = useQuery({
    queryKey: ['series', month, includePending],
    queryFn: () => api.get<MonthSeries>(`/api/reports/month/${month}/series${pending ? `?${pending}` : ''}`),
  })
  const { data: txns = [] } = useQuery({
    queryKey: ['txns', month, 'report'],
    queryFn: () => api.get<Transaction[]>(`/api/transactions?year_month=${month}`),
  })
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.patch(`/api/transactions/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['txns'] })
      qc.invalidateQueries({ queryKey: ['report'] })
      qc.invalidateQueries({ queryKey: ['series'] })
    },
  })

  return (
    <div>
      <header className="flex items-end justify-between mb-8">
        <div>
          <div className="text-[var(--muted)] text-sm mb-1">Settlement</div>
          <h1 className="text-3xl tracking-tight">Monthly split</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg bg-white text-black px-4 py-2 text-sm"
            disabled={pdfBusy}
            onClick={async () => {
              setPdfBusy(true)
              try {
                await downloadMonthPdf(month, includePending)
              } finally {
                setPdfBusy(false)
              }
            }}
          >
            {pdfBusy ? 'Exporting…' : 'Export PDF'}
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

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl border border-[var(--border)] p-6">
          <div className="text-xs uppercase tracking-widest text-[var(--muted)] mb-2">{settings?.person_a || 'Aprameya'}</div>
          <div className="text-4xl tabular">{report ? money(report.aprameya_share_cents) : '—'}</div>
          <div className="text-sm text-[var(--muted)] mt-2">A + half of shared</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] p-6">
          <div className="text-xs uppercase tracking-widest text-[var(--muted)] mb-2">{settings?.person_s || 'Savanthi'}</div>
          <div className="text-4xl tabular">{report ? money(report.savanthi_share_cents) : '—'}</div>
          <div className="text-sm text-[var(--muted)] mt-2">S + half of shared</div>
        </div>
      </div>

      <SpendCharts series={series} categoryTotals={report?.categories || []} />

      {report && (
        <p className="text-sm text-[var(--muted)] mb-8">
          Parity {money(report.parity_delta_cents)} · uncategorized {money(report.uncategorized_cents)}
        </p>
      )}

      <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-3">Transactions — edit Who anytime</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Changing a label recalculates the split above immediately.{' '}
        <Link className="underline" to={`/transactions?month=${month}`}>Open full activity</Link>
      </p>
      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {txns.slice(0, 80).map((t) => (
              <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                <td className="p-3 text-[var(--muted)] tabular whitespace-nowrap">{t.date}</td>
                <td className="p-3">{t.description}</td>
                <td className="p-3 text-[var(--muted)]">{t.category || '—'}</td>
                <td className="p-3">
                  <WhoControl
                    value={t.who}
                    onChange={(w) => patch.mutate({ id: t.id, body: { who: w } })}
                  />
                </td>
                <td className="p-3 text-right tabular">{money(t.amount_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
