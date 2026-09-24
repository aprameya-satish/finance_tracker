import { api, money, type MonthReport } from './api'

export type MonthSeries = {
  year_month: string
  categories: string[]
  daily: Array<Record<string, string | number>>
  cumulative: Array<Record<string, string | number>>
}

export const PALETTE = [
  '#00C805',
  '#5B8DEF',
  '#F5C542',
  '#FF5A5F',
  '#C084FC',
  '#2DD4BF',
  '#FB923C',
  '#94A3B8',
]

export async function downloadMonthPdf(month: string, includePending = false) {
  const suffix = includePending ? '?include_pending=true' : ''
  const report = await api.get<MonthReport>(`/api/reports/month/${month}${suffix}`)
  const html = `<!doctype html><meta charset="utf-8"><title>Finance ${month}</title>
  <style>body{font-family:system-ui;background:#0b0d0c;color:#e8e6e1;padding:24px} h1{font-weight:600} table{width:100%;border-collapse:collapse} td,th{border-bottom:1px solid #262a27;padding:8px;text-align:left}</style>
  <h1>${month}</h1>
  <p>Total ${money(report.total_cents)}</p>
  <p>Aprameya ${money(report.aprameya_share_cents)} · Savanthi ${money(report.savanthi_share_cents)}</p>
  <table><tr><th>Category</th><th>Total</th></tr>${report.categories
    .map((c) => `<tr><td>${c.category}</td><td>${money(c.total)}</td></tr>`)
    .join('')}</table>`
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finance-report-${month}.html`
  a.click()
  URL.revokeObjectURL(url)
}
