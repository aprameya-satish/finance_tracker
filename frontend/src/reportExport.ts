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

export async function downloadMonthPdf(month: string) {
  const res = await fetch(`/api/reports/month/${month}/pdf`)
  if (!res.ok) {
    throw new Error(await res.text())
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finance-report-${month}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
