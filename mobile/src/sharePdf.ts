import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { api } from './api'
import { money } from './money'
import type { MonthReport } from '../../shared/finance/types.ts'

export async function shareMonthPdf(_baseUrl: string, month: string, includePending: boolean) {
  const suffix = includePending ? '?include_pending=true' : ''
  const report = await api.get<MonthReport>(`/api/reports/month/${month}${suffix}`)
  const html = `<h1>${month}</h1><p>Total ${money(report.total_cents)}</p>`
  const dest = `${cacheDirectory}finance-report-${month}.html`
  await writeAsStringAsync(dest, html)
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest, { mimeType: 'text/html' })
  }
}
