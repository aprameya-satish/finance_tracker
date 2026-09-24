export function dollarsToCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,]/g, ''))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function centsToDollars(cents: number | null | undefined): number {
  if (cents == null) return 0
  return Math.round(cents) / 100
}

export function money(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const remainder = String(abs % 100).padStart(2, '0')
  return `${sign}$${dollars.toLocaleString('en-US')}.${remainder}`
}

export function shiftMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function pendingQuery(includePending: boolean) {
  return includePending ? 'include_pending=true' : ''
}

export function formatImportResult(data: { files: number; rows_ok: number; rows_skipped: number; errors: string[] }) {
  const summary = `Imported ${data.files} files · ${data.rows_ok} new · ${data.rows_skipped} existing`
  return data.errors.length ? `${summary} · ${data.errors.length} issue(s): ${data.errors.slice(0, 3).join('; ')}` : summary
}
