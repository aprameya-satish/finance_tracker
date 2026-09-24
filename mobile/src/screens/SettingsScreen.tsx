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
  const [health, setHealth] = useState('')

  useEffect(() => {
    if (!data) return
    setPersonA(data.person_a)
    setPersonS(data.person_s)
  }, [data])

  const save = useMutation({
    mutationFn: () => api.put('/api/settings', { person_a: personA, person_s: personS }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
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
      <View style={{ height: 12 }} />
      <PrimaryButton label={save.isPending ? 'Saving…' : 'Save household'} onPress={() => save.mutate()} />
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
