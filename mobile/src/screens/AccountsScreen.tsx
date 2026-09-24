import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as DocumentPicker from 'expo-document-picker'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useApp } from '../AppContext'
import { Card, Eyebrow, Field, GhostButton, PrimaryButton, Screen, Title } from '../components/ui'
import { formatImportResult } from '../money'
import { colors } from '../theme'
import type { Account, ImportResult, PlaidItem, Settings } from '../types'
import type { UploadFile } from '../api'

export default function AccountsScreen() {
  const { api } = useApp()
  const qc = useQueryClient()
  const navigation = useNavigation<{ navigate: (name: 'PlaidLink') => void }>()
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', api.root],
    queryFn: () => api.get<Account[]>('/api/accounts'),
  })
  const { data: items = [] } = useQuery({
    queryKey: ['plaid-items', api.root],
    queryFn: () => api.get<PlaidItem[]>('/api/plaid/items'),
  })
  const { data: settings } = useQuery({
    queryKey: ['settings', api.root],
    queryFn: () => api.get<Settings>('/api/settings'),
  })
  const [directory, setDirectory] = useState('')
  const [files, setFiles] = useState<UploadFile[]>([])
  const [result, setResult] = useState('')

  useEffect(() => {
    if (settings?.csv_import_directory && !directory) setDirectory(settings.csv_import_directory)
  }, [settings, directory])

  const importDir = useMutation({
    mutationFn: () => api.post<ImportResult>('/api/imports/directory', { directory: directory || undefined }),
    onSuccess: (data) => {
      setResult(formatImportResult(data))
      qc.invalidateQueries()
    },
    onError: (e: Error) => setResult(e.message),
  })
  const uploadFiles = useMutation({
    mutationFn: () => api.upload<ImportResult>('/api/imports/upload', files),
    onSuccess: (data) => {
      setResult(formatImportResult(data))
      setFiles([])
      qc.invalidateQueries()
    },
    onError: (e: Error) => setResult(e.message),
  })
  const sync = useMutation({
    mutationFn: () => api.post('/api/plaid/sync'),
    onSuccess: () => qc.invalidateQueries(),
  })

  return (
    <Screen>
      <Eyebrow>Sources</Eyebrow>
      <Title>Accounts</Title>
      {settings?.plaid_configured ? (
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <PrimaryButton label="Link account" onPress={() => navigation.navigate('PlaidLink')} />
          <GhostButton label={sync.isPending ? 'Syncing…' : 'Sync Plaid'} onPress={() => sync.mutate()} />
        </View>
      ) : (
        <Text style={{ color: colors.muted, marginBottom: 12 }}>
          Add PLAID_CLIENT_ID and PLAID_SECRET to the backend .env to link live accounts.
        </Text>
      )}
      {settings?.plaid_configured && (
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>
          {settings.plaid_env} · {settings.plaid_products.join(', ')}
        </Text>
      )}

      {items.map((item) => (
        <Card key={item.id}>
          <Text style={{ color: colors.text }}>{item.institution_name || item.item_id}</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>
            {item.last_synced_at ? new Date(item.last_synced_at).toLocaleString() : 'Never synced'}
          </Text>
        </Card>
      ))}

      <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginVertical: 12 }}>
        Connected
      </Text>
      {accounts.map((a) => (
        <Card key={a.id}>
          <Text style={{ color: colors.text }}>{a.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {a.institution} · {a.kind}
            {a.last4 ? ` · ${a.last4}` : ''}
          </Text>
        </Card>
      ))}
      {accounts.length === 0 && <Text style={{ color: colors.muted }}>No accounts yet. Import CSVs or link Plaid.</Text>}

      <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 }}>
        Upload CSVs
      </Text>
      <Text style={{ color: colors.muted, marginBottom: 10 }}>
        Pick Chase, Amex, or utilities CSVs from Files. The backend uses the same parsers as the web app.
      </Text>
      <PrimaryButton
        label="Choose files"
        onPress={async () => {
          const picked = await DocumentPicker.getDocumentAsync({
            type: ['text/csv', 'public.comma-separated-values-text', '*/*'],
            multiple: true,
            copyToCacheDirectory: true,
          })
          if (picked.canceled) return
          const next = picked.assets
            .filter((asset) => asset.name.toLowerCase().endsWith('.csv'))
            .map((asset) => ({ uri: asset.uri, name: asset.name, type: asset.mimeType || 'text/csv' }))
          setFiles((prev) => {
            const seen = new Set(prev.map((f) => `${f.name}:${f.uri}`))
            return [...prev, ...next.filter((f) => !seen.has(`${f.name}:${f.uri}`))]
          })
        }}
      />
      {files.map((file) => (
        <Card key={`${file.name}:${file.uri}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, flex: 1 }}>{file.name}</Text>
            <GhostButton label="Remove" onPress={() => setFiles((prev) => prev.filter((item) => item !== file))} />
          </View>
        </Card>
      ))}
      <View style={{ height: 8 }} />
      <PrimaryButton
        label={uploadFiles.isPending ? 'Processing…' : 'Upload & process'}
        disabled={!files.length || uploadFiles.isPending}
        onPress={() => uploadFiles.mutate()}
      />

      <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 28, marginBottom: 10 }}>
        Import from a folder
      </Text>
      <Text style={{ color: colors.muted, marginBottom: 8 }}>
        This path is on the computer running the API, not on the iPhone.
      </Text>
      <Field label="Directory" value={directory} onChangeText={setDirectory} placeholder="E:\\finance\\expense_tracking" />
      <View style={{ height: 10 }} />
      <PrimaryButton label="Import folder" onPress={() => importDir.mutate()} />
      {!!result && <Text style={{ color: colors.muted, marginTop: 12 }}>{result}</Text>}
    </Screen>
  )
}
