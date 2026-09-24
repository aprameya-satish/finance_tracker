import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useApp } from '../AppContext'
import {
  Card,
  Eyebrow,
  Field,
  MonthStepper,
  PendingToggle,
  PickerModal,
  PrimaryButton,
  ProgressBar,
  Screen,
  Title,
} from '../components/ui'
import { money, pendingQuery } from '../money'
import { colors } from '../theme'
import type { BudgetRow, Category } from '../types'

export default function BudgetsScreen() {
  const { api, month, setMonth, includePending, setIncludePending } = useApp()
  const pending = pendingQuery(includePending)
  const qc = useQueryClient()
  const { data: rows = [] } = useQuery({
    queryKey: ['budgets', month, includePending, api.root],
    queryFn: () => api.get<BudgetRow[]>(`/api/budgets/${month}${pending ? `?${pending}` : ''}`),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', api.root],
    queryFn: () => api.get<Category[]>('/api/categories'),
  })
  const upsert = useMutation({
    mutationFn: (body: { year_month: string; category_id: number; limit_cents: number }) => api.put('/api/budgets', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['report'] })
    },
  })
  const copy = useMutation({
    mutationFn: () => {
      const [y, m] = month.split('-').map(Number)
      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
      return api.post('/api/budgets/copy', { from_month: prev, to_month: month })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
  const [newCat, setNewCat] = useState('')
  const [newLimit, setNewLimit] = useState('')
  const [open, setOpen] = useState(false)
  const selected = categories.find((c) => String(c.id) === newCat)

  return (
    <Screen>
      <Eyebrow>Household</Eyebrow>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title>Budgets</Title>
        <MonthStepper value={month} onChange={setMonth} />
      </View>
      <PendingToggle value={includePending} onChange={setIncludePending} />
      <View style={{ marginVertical: 12 }}>
        <PrimaryButton label={copy.isPending ? 'Copying…' : 'Copy previous month'} onPress={() => copy.mutate()} />
      </View>
      <Card>
        <Text style={{ color: colors.muted, marginBottom: 8 }} onPress={() => setOpen(true)}>
          {selected?.name || 'Add category limit'}
        </Text>
        <Field label="Limit USD" value={newLimit} onChangeText={setNewLimit} keyboardType="numeric" placeholder="500" />
        <View style={{ height: 12 }} />
        <PrimaryButton
          label="Save"
          disabled={!newCat || !newLimit}
          onPress={() => {
            upsert.mutate({
              year_month: month,
              category_id: Number(newCat),
              limit_cents: Math.round(Number(newLimit) * 100),
            })
            setNewLimit('')
          }}
        />
      </Card>
      {rows
        .filter((r) => r.limit_cents > 0 || r.status === 'over' || r.status === 'unbudgeted')
        .map((row) => {
          const pct = row.limit_cents ? Math.min(100, (row.spent_cents / row.limit_cents) * 100) : 0
          return (
            <Card key={row.category_id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: colors.text }}>{row.category}</Text>
                <Text style={{ color: colors.muted, fontVariant: ['tabular-nums'] }}>
                  {money(row.spent_cents)}
                  {row.limit_cents ? ` / ${money(row.limit_cents)}` : ' unbudgeted'}
                </Text>
              </View>
              <ProgressBar pct={pct} status={row.status} />
            </Card>
          )
        })}
      <PickerModal
        visible={open}
        title="Category"
        options={categories.filter((c) => c.include_in_budget).map((c) => ({ id: String(c.id), label: c.name }))}
        onClose={() => setOpen(false)}
        onSelect={(option) => {
          setNewCat(option.id)
          setOpen(false)
        }}
      />
    </Screen>
  )
}
