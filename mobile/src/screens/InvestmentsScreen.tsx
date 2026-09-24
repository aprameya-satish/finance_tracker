import { useQuery } from '@tanstack/react-query'
import { Text } from 'react-native'
import { useApp } from '../AppContext'
import { Card, Eyebrow, Screen, Title } from '../components/ui'
import { money } from '../money'
import { colors } from '../theme'
import type { InvestmentSummary } from '../types'

export default function InvestmentsScreen() {
  const { api } = useApp()
  const { data } = useQuery({
    queryKey: ['investments', api.root],
    queryFn: () => api.get<InvestmentSummary>('/api/investments/summary'),
  })
  return (
    <Screen>
      <Eyebrow>Next step</Eyebrow>
      <Title>Investments</Title>
      <Card>
        <Text style={{ color: colors.text, fontSize: 40, fontVariant: ['tabular-nums'], marginBottom: 12 }}>
          {money(data?.value_cents || 0)}
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 22 }}>
          Holdings will appear here after brokerage accounts are linked. Cash contributions already live on the spending
          ledger as investment transfers and stay out of category budgets.
        </Text>
      </Card>
    </Screen>
  )
}
