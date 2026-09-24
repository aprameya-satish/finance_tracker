import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Text, View } from 'react-native'
import { useApp } from '../AppContext'
import { Card, CategoryBars, Eyebrow, MonthStepper, PendingToggle, Screen, Title, WhoControl } from '../components/ui'
import { money, pendingQuery } from '../money'
import { shareMonthPdf } from '../sharePdf'
import { colors } from '../theme'
import type { MonthReport, Settings, Transaction } from '../types'

export default function SplitScreen() {
  const { api, month, setMonth, includePending, setIncludePending } = useApp()
  const pending = pendingQuery(includePending)
  const qc = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: ['settings', api.root],
    queryFn: () => api.get<Settings>('/api/settings'),
  })
  const { data: report } = useQuery({
    queryKey: ['report', month, includePending, api.root],
    queryFn: () => api.get<MonthReport>(`/api/reports/month/${month}${pending ? `?${pending}` : ''}`),
  })
  const { data: txns = [] } = useQuery({
    queryKey: ['txns', month, 'report', api.root],
    queryFn: () => api.get<Transaction[]>(`/api/transactions?year_month=${month}`),
  })
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.patch(`/api/transactions/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['txns'] })
      qc.invalidateQueries({ queryKey: ['report'] })
    },
  })

  return (
    <Screen>
      <Eyebrow>Settlement</Eyebrow>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title>Monthly split</Title>
        <MonthStepper value={month} onChange={setMonth} />
      </View>
      <PendingToggle value={includePending} onChange={setIncludePending} />
      <Text
        style={{ color: colors.muted, marginVertical: 12 }}
        onPress={async () => {
          try {
            await shareMonthPdf(api.root, month, includePending)
          } catch (err) {
            Alert.alert('Export failed', err instanceof Error ? err.message : 'Could not export PDF')
          }
        }}
      >
        Export PDF
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
            {settings?.person_a || 'Aprameya'}
          </Text>
          <Text style={{ color: colors.text, fontSize: 28, fontVariant: ['tabular-nums'], marginTop: 8 }}>
            {report ? money(report.aprameya_share_cents) : '—'}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>A + half of shared</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
            {settings?.person_s || 'Savanthi'}
          </Text>
          <Text style={{ color: colors.text, fontSize: 28, fontVariant: ['tabular-nums'], marginTop: 8 }}>
            {report ? money(report.savanthi_share_cents) : '—'}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>S + half of shared</Text>
        </Card>
      </View>
      {report && <CategoryBars rows={report.categories} />}
      {report && (
        <Text style={{ color: colors.muted, marginVertical: 16 }}>
          Parity {money(report.parity_delta_cents)} · uncategorized {money(report.uncategorized_cents)}
        </Text>
      )}
      <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 }}>
        Edit Who anytime
      </Text>
      {txns.slice(0, 80).map((t) => (
        <Card key={t.id}>
          <Text style={{ color: colors.muted, fontVariant: ['tabular-nums'] }}>{t.date}</Text>
          <Text style={{ color: colors.text, marginVertical: 6 }}>{t.description}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <WhoControl value={t.who} onChange={(w) => patch.mutate({ id: t.id, body: { who: w } })} />
            <Text style={{ color: colors.text, fontVariant: ['tabular-nums'] }}>{money(t.amount_cents)}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  )
}
