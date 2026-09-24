import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useApp } from '../AppContext'
import { Card, Eyebrow, Field, PrimaryButton, Screen, Title } from '../components/ui'
import { financeStore } from '../local'
import { colors } from '../theme'
import type { Category, Settings } from '../../../shared/finance/types.ts'

export default function SettingsScreen() {
  const { api } = useApp()
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['settings', api.root],
    queryFn: () => api.get<Settings>('/api/settings'),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', api.root],
    queryFn: () => api.get<Category[]>('/api/categories'),
  })
  const [personA, setPersonA] = useState('Aprameya')
  const [personS, setPersonS] = useState('Savanthi')
  const [plaidUrl, setPlaidUrl] = useState('')
  const [plaidKey, setPlaidKey] = useState('')
  const [health, setHealth] = useState('')

  useEffect(() => {
    if (!data) return
    setPersonA(data.person_a)
    setPersonS(data.person_s)
    setPlaidUrl(data.plaid_api_url || '')
    setPlaidKey(data.plaid_api_key || '')
  }, [data])

  const save = useMutation({
    mutationFn: () =>
      api.put('/api/settings', {
        person_a: personA,
        person_s: personS,
        plaid_api_url: plaidUrl,
        plaid_api_key: plaidKey,
      }),
    onSuccess: () => {
      qc.invalidateQueries()
      setHealth('Saved.')
    },
    onError: (err: Error) => setHealth(err.message),
  })
  const ping = useMutation({
    mutationFn: async () => {
      await api.put('/api/settings', { plaid_api_url: plaidUrl, plaid_api_key: plaidKey })
      return api.get<Settings>('/api/settings')
    },
    onSuccess: (next) => {
      qc.invalidateQueries()
      if (next.plaid_env === 'unreachable') setHealth('Saved, but the hosted API did not respond.')
      else if (!next.plaid_configured) setHealth(`Reached ${next.plaid_env}, but Plaid keys are not set on the server.`)
      else setHealth(`Plaid ready (${next.plaid_env}). Link a bank from Accounts.`)
    },
    onError: (err: Error) => setHealth(err.message),
  })
  const toggleBudget = useMutation({
    mutationFn: (c: Category) => api.patch(`/api/categories/${c.id}`, { include_in_budget: !c.include_in_budget }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  return (
    <Screen>
      <Eyebrow>On this phone</Eyebrow>
      <Title>Settings</Title>
      <Text style={{ color: colors.muted, marginBottom: 16, lineHeight: 20 }}>
        Data stays on this iPhone. No computer or server is required. Export a backup if you change phones.
      </Text>
      <Field label="Person A" value={personA} onChangeText={setPersonA} />
      <View style={{ height: 10 }} />
      <Field label="Person S" value={personS} onChangeText={setPersonS} />
      <View style={{ height: 10 }} />
      <Field
        label="Plaid API URL"
        value={plaidUrl}
        onChangeText={setPlaidUrl}
        placeholder="https://your-api.onrender.com"
        keyboardType="url"
      />
      <View style={{ height: 10 }} />
      <Field
        label="API key (optional)"
        value={plaidKey}
        onChangeText={setPlaidKey}
        placeholder="X-Finance-Key if the host requires one"
      />
      <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 12, lineHeight: 20 }}>
        Plaid secrets stay on the hosted API.
        {data?.plaid_configured ? ` Ready (${data.plaid_env}).` : data?.plaid_api_url ? ` ${data.plaid_env}.` : ''}
      </Text>
      <PrimaryButton label={save.isPending ? 'Saving…' : 'Save household'} onPress={() => save.mutate()} />
      <View style={{ height: 10 }} />
      <PrimaryButton label={ping.isPending ? 'Checking…' : 'Test Plaid API'} onPress={() => ping.mutate()} />
      <View style={{ height: 16 }} />
      <PrimaryButton
        label="Export backup"
        onPress={async () => {
          const dest = `${cacheDirectory}finance-backup.json`
          await writeAsStringAsync(dest, financeStore.exportJson())
          if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dest)
          setHealth('Backup ready to share.')
        }}
      />
      <View style={{ height: 10 }} />
      <PrimaryButton
        label="Restore backup"
        onPress={async () => {
          const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true })
          if (picked.canceled || !picked.assets[0]) return
          const text = await (await fetch(picked.assets[0].uri)).text()
          await financeStore.importJson(text)
          qc.invalidateQueries()
          setHealth('Backup restored.')
        }}
      />
      {!!health && <Text style={{ color: colors.muted, marginTop: 8 }}>{health}</Text>}
      <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 24, marginBottom: 8 }}>
        Categories
      </Text>
      {categories.map((c) => (
        <Card key={c.id} onPress={() => toggleBudget.mutate(c)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text }}>{c.name}</Text>
            <Text style={{ color: colors.muted }}>{c.include_in_budget ? 'In budget' : 'Excluded'}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  )
}
