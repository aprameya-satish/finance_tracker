import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as DocumentPicker from 'expo-document-picker'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useApp } from '../AppContext'
import type { UploadFile } from '../legacyTypes'
import { Card, Eyebrow, GhostButton, PrimaryButton, Screen, Title } from '../components/ui'
import { formatImportResult } from '../money'
import { colors } from '../theme'
import type { Account, ImportResult, PlaidItem, Settings } from '../../../shared/finance/types.ts'

export default function AccountsScreen() {
  const { api } = useApp()
  const navigation = useNavigation<{ navigate: (name: 'PlaidLink') => void }>()
  const qc = useQueryClient()
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', api.root],
    queryFn: () => api.get<Account[]>('/api/accounts'),
  })
  const { data: settings } = useQuery({
    queryKey: ['settings', api.root],
    queryFn: () => api.get<Settings>('/api/settings'),
  })
  const { data: items = [] } = useQuery({
    queryKey: ['plaid-items', api.root],
    queryFn: () => api.get<PlaidItem[]>('/api/plaid/items'),
    enabled: Boolean(settings?.plaid_api_url),
  })
  const [files, setFiles] = useState<UploadFile[]>([])
  const [result, setResult] = useState('')
  const uploadFiles = useMutation({
    mutationFn: () => api.upload<ImportResult>('/api/imports/upload', files),
    onSuccess: (data) => {
      setResult(formatImportResult(data))
      setFiles([])
      qc.invalidateQueries()
    },
    onError: (e: Error) => setResult(e.message),
  })
  const syncPlaid = useMutation({
    mutationFn: () => api.post('/api/plaid/sync'),
    onSuccess: () => {
      setResult('Plaid sync finished. Transactions are on this phone.')
      qc.invalidateQueries()
    },
    onError: (e: Error) => setResult(e.message),
  })
  const plaidReady = Boolean(settings?.plaid_api_url && settings.plaid_configured)

  return (
    <Screen>
      <Eyebrow>On this phone</Eyebrow>
      <Title>Accounts</Title>
      <Text style={{ color: colors.muted, marginBottom: 16, lineHeight: 20 }}>
        Upload CSVs from Files, or link a bank through a hosted Plaid API URL in Settings. Who labels stay editable.
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>
        Plaid
      </Text>
      {!settings?.plaid_api_url && (
        <Text style={{ color: colors.muted, marginBottom: 12 }}>Set a hosted Plaid API URL in Settings to link Chase or Amex.</Text>
      )}
      {settings?.plaid_api_url && settings.plaid_env === 'unreachable' && (
        <Text style={{ color: colors.muted, marginBottom: 12 }}>Hosted API is unreachable. Check the URL and API key.</Text>
      )}
      {settings?.plaid_api_url && settings.plaid_env !== 'unreachable' && !settings.plaid_configured && (
        <Text style={{ color: colors.muted, marginBottom: 12 }}>
          Host reached, but Plaid keys are missing on the server.
        </Text>
      )}
      {plaidReady && (
        <>
          <PrimaryButton label="Link bank" onPress={() => navigation.navigate('PlaidLink')} />
          <View style={{ height: 10 }} />
          <PrimaryButton
            label={syncPlaid.isPending ? 'Syncing…' : 'Sync accounts'}
            disabled={syncPlaid.isPending}
            onPress={() => syncPlaid.mutate()}
          />
        </>
      )}
      {items.map((item) => (
        <Card key={item.id}>
          <Text style={{ color: colors.text }}>{item.institution_name || item.item_id}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {item.status}
            {item.last_synced_at ? ` · last sync ${String(item.last_synced_at).replace('T', ' ').slice(0, 16)}` : ''}
          </Text>
        </Card>
      ))}
      <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 }}>
        Connected
      </Text>
      {accounts.map((a) => (
        <Card key={a.id}>
          <Text style={{ color: colors.text }}>{a.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {a.institution} · {a.kind}
            {a.last4 ? ` · ${a.last4}` : ''}
            {a.plaid_account_id ? ' · Plaid' : ''}
          </Text>
        </Card>
      ))}
      {accounts.length === 0 && <Text style={{ color: colors.muted, marginBottom: 12 }}>No accounts yet. Link a bank or upload a statement CSV.</Text>}
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
          setFiles((prev) => [...prev, ...next])
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
      {!!result && <Text style={{ color: colors.muted, marginTop: 12 }}>{result}</Text>}
    </Screen>
  )
}
