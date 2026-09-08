import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, money, type MonthReport, type Settings } from '../api'
import MonthPicker from '../components/MonthPicker'
import PendingToggle from '../components/PendingToggle'
import SpendCharts from '../components/SpendCharts'
import { downloadMonthPdf, type MonthSeries } from '../reportExport'
import { pendingQuery, useIncludePending, useMonth } from '../useMonth'

export default function Dashboard() {
  const month = useMonth()
  const [params, setParams] = useSearchParams()
  const [includePending, setIncludePending] = useIncludePending()
  const pending = pendingQuery(includePending)
  const [pdfError, setPdfError] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const { data: report } = useQuery({
    queryKey: ['report', month, includePending],
    queryFn: () => api.get<MonthReport>(`/api/reports/month/${month}${pending ? `?${pending}` : ''}`),
  })
  const { data: series } = useQuery({
    queryKey: ['series', month, includePending],
    queryFn: () => api.get<MonthSeries>(`/api/reports/month/${month}/series${pending ? `?${pending}` : ''}`),
  })
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/api/settings'),
  })
  const exceed = (report?.budgets || []).filter((b) => b.status === 'over' || b.status === 'watch')

  return (
    <div>
      <header className="flex items-end justify-between mb-10 gap-4">
        <div>
          <div className="text-[var(--muted)] text-sm mb-2">This month</div>
          <div className="text-5xl tabular tracking-tight">{report ? money(report.total_cents) : '—'}</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg bg-white text-black px-4 py-2 text-sm"
            disabled={pdfBusy}
            onClick={async () => {
              setPdfError('')
              setPdfBusy(true)
              try {
                await downloadMonthPdf(month, includePending)
              } catch (err) {
                setPdfError(err instanceof Error ? err.message : 'PDF export failed')
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
      {pdfError && <p className="text-sm text-[var(--red)] mb-4">{pdfError}</p>}

      <div className="grid grid-cols-3 gap-4 mb-10">
        {(
          [
            ['A', settings?.person_a || 'A', report?.a_cents, 'A'],
            ['S', settings?.person_s || 'S', report?.s_cents, 'S'],
            ['Shared', 'Shared', report?.shared_cents, 'shared'],
          ] as const
        ).map(([label, name, cents, who]) => (
          <Link
            key={label}
            to={`/transactions?month=${month}&who=${who}`}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--muted)]"
          >
            <div className="text-xs uppercase tracking-widest text-[var(--muted)] mb-3">{name}</div>
            <div className="text-2xl tabular">{cents != null ? money(cents) : '—'}</div>
          </Link>
        ))}
      </div>

      <SpendCharts series={series} categoryTotals={report?.categories || []} />

      <section className="mb-10">
        <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-4">Exceedances</h2>
        {exceed.length === 0 ? (
          <p className="text-[var(--muted)]">No category over 80% of its budget this month.</p>
        ) : (
          <div className="space-y-3">
            {exceed.map((row) => (
              <div key={row.category_id} className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div>
                  <div>{row.category}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {money(row.spent_cents)} of {money(row.limit_cents)}
                  </div>
                </div>
                <div className={`tabular ${row.status === 'over' ? 'text-[var(--red)]' : 'text-[var(--amber)]'}`}>
                  {row.status === 'over' ? '+' : ''}
                  {money(-row.delta_cents)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
