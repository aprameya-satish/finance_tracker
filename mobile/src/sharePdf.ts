import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

export async function shareMonthPdf(baseUrl: string, month: string, includePending: boolean) {
  const suffix = includePending ? '?include_pending=true' : ''
  const url = `${baseUrl.replace(/\/$/, '')}/api/reports/month/${month}/pdf${suffix}`
  const dest = `${cacheDirectory}finance-report-${month}.pdf`
  const result = await downloadAsync(url, dest)
  if (result.status !== 200) throw new Error('PDF download failed')
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })
  }
}
