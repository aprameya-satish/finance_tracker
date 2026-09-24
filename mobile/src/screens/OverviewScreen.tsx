import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { Alert, Pressable, Text, View } from 'react-native'
import { useApp } from '../AppContext'
import { CategoryBars, Card, Eyebrow, MonthStepper, PendingToggle, Screen } from '../components/ui'
import { money, pendingQuery } from '../money'
import { colors } from '../theme'
import type { MonthReport, Settings } from '../types'
import { shareMonthPdf } from '../sharePdf'

export default function OverviewScreen() {
  const { api, month, setMonth, includePending, setIncludePending } = useApp()
  const navigation = useNavigation<{ navigate: (name: 'Activity', params?: { who?: string }) => void }>()
  const pending = pendingQuery(includePending)
  const { data: report } = useQuery({
    queryKey: ['report', month, includePending, api.root],
    queryFn: () => api.get<MonthReport>(`/api/reports/month/${month}${pending ? `?${pending}` : ''}`),
  })
  const { data: settings } = useQuery({
    queryKey: ['settings', api.root],
    queryFn: () => api.get<Settings>('/api/settings'),
  })
  const exceed = (report?.budgets || []).filter((b) => b.status === 'over' || b.status === 'watch')

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
        <View>
          <Eyebrow>This month</Eyebrow>
          <Text style={{ color: colors.text, fontSize: 40, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -1 }}>
            {report ? money(report.total_cents) : '—'}
          </Text>
        </View>
        <MonthStepper value={month} onChange={setMonth} />
      </View>
      <PendingToggle value={includePending} onChange={setIncludePending} />
      <View style={{ marginVertical: 14 }}>
        <Pressable
          onPress={async () => {
            try {
              await shareMonthPdf(api.root, month, includePending)
            } catch (err) {
              Alert.alert('Export failed', err instanceof Error ? err.message : 'Could not export PDF')
            }
          }}
        >
          <Text style={{ color: colors.muted }}>Export PDF</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
        {(
          [
            [settings?.person_a || 'A', report?.a_cents, 'A'],
            [settings?.person_s || 'S', report?.s_cents, 'S'],
            ['Shared', report?.shared_cents, 'shared'],
          ] as const
        ).map(([name, cents, who]) => (
          <Card key={who} style={{ flex: 1 }} onPress={() => navigation.navigate('Activity', { who })}>
            <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              {name}
            </Text>
            <Text style={{ color: colors.text, fontSize: 18, fontVariant: ['tabular-nums'] }}>
              {cents != null ? money(cents) : '—'}
            </Text>
          </Card>
        ))}
      </View>

      {report && <CategoryBars rows={report.categories} />}

      <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 28, marginBottom: 10 }}>
        Exceedances
      </Text>
      {exceed.length === 0 ? (
        <Text style={{ color: colors.muted }}>No category over 80% of its budget this month.</Text>
      ) : (
        exceed.map((row) => (
          <Card key={row.category_id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: colors.text }}>{row.category}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {money(row.spent_cents)} of {money(row.limit_cents)}
                </Text>
              </View>
              <Text style={{ color: row.status === 'over' ? colors.red : colors.amber, fontVariant: ['tabular-nums'] }}>
                {row.status === 'over' ? '+' : ''}
                {money(-row.delta_cents)}
              </Text>
            </View>
          </Card>
        ))
      )}
    </Screen>
  )
}
