import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as DocumentPicker from 'expo-document-picker'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useApp } from '../AppContext'
import type { UploadFile } from '../legacyTypes'
import { Card, Eyebrow, GhostButton, PrimaryButton, Screen, Title } from '../components/ui'
import { formatImportResult } from '../money'
import { colors } from '../theme'
import type { Account, ImportResult } from '../../../shared/finance/types.ts'

export default function AccountsScreen() {
  const { api } = useApp()
  const qc = useQueryClient()
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', api.root],
    queryFn: () => api.get<Account[]>('/api/accounts'),
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

  return (
    <Screen>
      <Eyebrow>On this phone</Eyebrow>
      <Title>Accounts</Title>
      <Text style={{ color: colors.muted, marginBottom: 16, lineHeight: 20 }}>
        Upload Chase, Amex, or utilities CSVs from Files. Processing stays on this iPhone.
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>
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
      {accounts.length === 0 && <Text style={{ color: colors.muted, marginBottom: 12 }}>No accounts yet. Upload a statement CSV.</Text>}
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
