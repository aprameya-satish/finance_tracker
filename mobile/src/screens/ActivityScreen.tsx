import { useRoute } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useApp } from '../AppContext'
import { Card, Eyebrow, MonthStepper, PickerModal, Screen, Title, WhoControl } from '../components/ui'
import { money } from '../money'
import { colors } from '../theme'
import type { Account, Category, Transaction } from '../types'

function txnPath(month: string, who: string, q: string, accountId: string, categoryId: string, review = false) {
  const p = new URLSearchParams()
  if (month) p.set('year_month', month)
  if (who) p.set('who', who)
  if (q) p.set('q', q)
  if (accountId) p.set('account_id', accountId)
  if (categoryId) p.set('category_id', categoryId)
  if (review) p.set('review', 'true')
  return `/api/transactions?${p}`
}

export default function ActivityScreen({ reviewOnly = false }: { reviewOnly?: boolean }) {
  const { api, month, setMonth } = useApp()
  const route = useRoute()
  const params = (route.params || {}) as { who?: string }
  const [who, setWho] = useState(params.who || '')
  useEffect(() => {
    if (params.who) setWho(params.who)
  }, [params.who])
  const [q, setQ] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [picker, setPicker] = useState<null | { title: string; options: { id: string; label: string }[]; onSelect: (id: string) => void }>(null)
  const qc = useQueryClient()
  const { data: rows = [] } = useQuery({
    queryKey: ['txns', month, who, q, accountId, categoryId, reviewOnly, api.root],
    queryFn: () => api.get<Transaction[]>(txnPath(month, who, q, accountId, categoryId, reviewOnly)),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', api.root],
    queryFn: () => api.get<Category[]>('/api/categories'),
  })
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', api.root],
    queryFn: () => api.get<Account[]>('/api/accounts'),
  })
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.patch(`/api/transactions/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['txns'] })
      qc.invalidateQueries({ queryKey: ['report'] })
    },
  })

  const accountLabel = useMemo(
    () => accounts.find((a) => String(a.id) === accountId)?.name || 'All accounts',
    [accounts, accountId],
  )
  const categoryLabel = useMemo(
    () => categories.find((c) => String(c.id) === categoryId)?.name || 'All categories',
    [categories, categoryId],
  )
  const whoLabel = who === 'A' ? 'A' : who === 'S' ? 'S' : who === 'shared' ? 'Shared' : 'All people'

  return (
    <Screen>
      <Eyebrow>{reviewOnly ? 'Needs a look' : 'Activity'}</Eyebrow>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title>{reviewOnly ? 'Review queue' : 'Transactions'}</Title>
        <MonthStepper value={month} onChange={setMonth} />
      </View>
      <TextInput
        placeholder="Search"
        placeholderTextColor={colors.muted}
        value={q}
        onChangeText={setQ}
        style={{
          backgroundColor: colors.surface2,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          color: colors.text,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 10,
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <FilterChip
          label={whoLabel}
          onPress={() =>
            setPicker({
              title: 'Who',
              options: [
                { id: '', label: 'All people' },
                { id: 'A', label: 'A' },
                { id: 'S', label: 'S' },
                { id: 'shared', label: 'Shared' },
              ],
              onSelect: setWho,
            })
          }
        />
        <FilterChip
          label={accountLabel}
          onPress={() =>
            setPicker({
              title: 'Account',
              options: [{ id: '', label: 'All accounts' }, ...accounts.map((a) => ({ id: String(a.id), label: a.name }))],
              onSelect: setAccountId,
            })
          }
        />
        <FilterChip
          label={categoryLabel}
          onPress={() =>
            setPicker({
              title: 'Category',
              options: [{ id: '', label: 'All categories' }, ...categories.map((c) => ({ id: String(c.id), label: c.name }))],
              onSelect: setCategoryId,
            })
          }
        />
      </View>

      {rows.map((t) => (
        <Card key={t.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: colors.muted, fontVariant: ['tabular-nums'] }}>{t.date}</Text>
            <Text style={{ color: t.amount_cents < 0 ? colors.green : colors.text, fontVariant: ['tabular-nums'] }}>
              {money(t.amount_cents)}
            </Text>
          </View>
          <Text style={{ color: colors.text, marginBottom: 4 }}>{t.description}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
            {t.account_name} · {t.txn_kind}
            {t.pending ? ' · pending' : ''}
          </Text>
          <Pressable
            onPress={() =>
              setPicker({
                title: 'Category',
                options: [
                  { id: '', label: 'Uncategorized' },
                  ...categories.map((c) => ({ id: String(c.id), label: c.name })),
                ],
                onSelect: (id) => {
                  if (!id) return
                  patch.mutate({ id: t.id, body: { category_id: Number(id), update_merchant_rule: true } })
                },
              })
            }
          >
            <Text style={{ color: colors.muted, marginBottom: 8 }}>{t.category || 'Uncategorized'}</Text>
          </Pressable>
          {t.category_confidence != null && t.category_source !== 'user' && (
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>
              {t.category_source} {(t.category_confidence * 100).toFixed(0)}%
            </Text>
          )}
          <WhoControl value={t.who} onChange={(w) => patch.mutate({ id: t.id, body: { who: w, update_merchant_rule: false } })} />
        </Card>
      ))}
      {rows.length === 0 && <Text style={{ color: colors.muted, paddingVertical: 24 }}>No transactions in this view.</Text>}

      <PickerModal
        visible={!!picker}
        title={picker?.title || ''}
        options={picker?.options || []}
        onClose={() => setPicker(null)}
        onSelect={(option) => {
          picker?.onSelect(option.id)
          setPicker(null)
        }}
      />
    </Screen>
  )
}

function FilterChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
    >
      <Text style={{ color: colors.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  )
}
