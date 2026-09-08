import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { money } from '../api'
import { PALETTE, type MonthSeries } from '../reportExport'

const axis = { fill: '#8a8d87', fontSize: 11 }
const grid = '#262a27'

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
      <div className="text-[var(--muted)] mb-1">{label}</div>
      {payload
        .filter((p) => p.value)
        .slice()
        .reverse()
        .map((p) => (
          <div key={p.name} className="flex justify-between gap-6 tabular">
            <span style={{ color: p.color }}>{p.name}</span>
            <span>{money(Number(p.value) || 0)}</span>
          </div>
        ))}
    </div>
  )
}

export default function SpendCharts({
  series,
  categoryTotals,
}: {
  series?: MonthSeries
  categoryTotals: { category: string; total: number }[]
}) {
  const barData = [...categoryTotals].reverse().map((row) => ({
    category: row.category,
    total: row.total,
  }))
  const cats = series?.categories || []
  const cumulative = (series?.cumulative || []).map((row) => row)

  return (
    <div className="grid gap-6 lg:grid-cols-2 mb-10">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-4">Spend by category</h2>
        {barData.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">No spend this month.</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                <CartesianGrid stroke={grid} horizontal={false} />
                <XAxis type="number" tick={axis} tickFormatter={(v) => `$${Math.round(Number(v) / 100)}`} />
                <YAxis type="category" dataKey="category" width={110} tick={axis} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#1a1d1b' }} />
                <Bar dataKey="total" fill={PALETTE[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-4">Over the month</h2>
        {cats.length === 0 || cumulative.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">No spend this month.</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulative} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="day" tick={axis} />
                <YAxis tick={axis} tickFormatter={(v) => `$${Math.round(Number(v) / 100)}`} width={52} />
                <Tooltip
                  content={<ChartTooltip />}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date ? String(payload[0].payload.date) : ''
                  }
                />
                {cats.map((cat, i) => (
                  <Area
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    stackId="spend"
                    stroke={PALETTE[i % PALETTE.length]}
                    fill={PALETTE[i % PALETTE.length]}
                    fillOpacity={0.72}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {cats.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-[var(--muted)]">
            {cats.map((cat, i) => (
              <span key={cat} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                {cat}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
