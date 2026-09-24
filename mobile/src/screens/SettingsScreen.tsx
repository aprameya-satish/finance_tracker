import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useApp } from '../AppContext'
import { Card, Eyebrow, Field, PrimaryButton, Screen, Title } from '../components/ui'
import { createApi, suggestedApiBaseUrl } from '../api'
import { colors } from '../theme'
import type { Category, Health, Settings } from '../types'

export default function SettingsScreen() {
  const { api, baseUrl, setBaseUrl } = useApp()
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
  const [directory, setDirectory] = useState('')
  const [url, setUrl] = useState(baseUrl)
  const [health, setHealth] = useState('')

  useEffect(() => {
    setUrl(baseUrl)
  }, [baseUrl])
  useEffect(() => {
    if (!data) return
    setPersonA(data.person_a)
    setPersonS(data.person_s)
    setDirectory(data.csv_import_directory)
  }, [data])

  const save = useMutation({
    mutationFn: () => api.put('/api/settings', { person_a: personA, person_s: personS, csv_import_directory: directory }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
  const toggleBudget = useMutation({
    mutationFn: (c: Category) => api.patch(`/api/categories/${c.id}`, { include_in_budget: !c.include_in_budget }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  return (
    <Screen>
      <Eyebrow>Household</Eyebrow>
      <Title>Settings</Title>
      <Field label="API URL" value={url} onChangeText={setUrl} keyboardType="url" placeholder={suggestedApiBaseUrl()} />
      <View style={{ height: 10 }} />
      <PrimaryButton
        label="Save & test connection"
        onPress={async () => {
          await setBaseUrl(url)
          try {
            const res = await createApi(url).get<Health>('/api/health')
            setHealth(res.ok ? `Connected · Plaid ${res.plaid_configured ? 'on' : 'off'}` : 'Unexpected health response')
          } catch (err) {
            setHealth(err instanceof Error ? err.message : 'Could not reach API')
          }
        }}
      />
      {!!health && <Text style={{ color: colors.muted, marginTop: 8 }}>{health}</Text>}
      <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 20 }}>
        On a physical iPhone, use your computer’s LAN address and run the API with `--host 0.0.0.0`.
      </Text>

      <Field label="Person A" value={personA} onChangeText={setPersonA} />
      <View style={{ height: 10 }} />
      <Field label="Person S" value={personS} onChangeText={setPersonS} />
      <View style={{ height: 10 }} />
      <Field label="Default CSV directory" value={directory} onChangeText={setDirectory} />
      <View style={{ height: 12 }} />
      <PrimaryButton label={save.isPending ? 'Saving…' : 'Save household'} onPress={() => save.mutate()} />

      <Text style={{ color: colors.muted, marginTop: 24, marginBottom: 8 }}>
        {data?.plaid_configured ? `Plaid configured (${data.plaid_env})` : 'Plaid is not configured. Keys stay in the backend .env.'}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>
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
