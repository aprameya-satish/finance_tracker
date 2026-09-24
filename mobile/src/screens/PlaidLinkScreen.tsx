import { useNavigation } from '@react-navigation/native'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { useApp } from '../AppContext'
import { colors } from '../theme'

export default function PlaidLinkScreen() {
  const { api } = useApp()
  const navigation = useNavigation()
  const qc = useQueryClient()
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .post<{ link_token: string }>('/api/plaid/link-token')
      .then((res) => setToken(res.link_token))
      .catch((err: Error) => setError(err.message))
  }, [api])

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: colors.red }}>{error}</Text>
      </View>
    )
  }
  if (!token) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.white} />
      </View>
    )
  }

  return (
    <WebView
      source={{ uri: `https://cdn.plaid.com/link/v2/stable/link.html?isWebview=true&token=${token}` }}
      style={{ flex: 1, backgroundColor: colors.bg }}
      onMessage={async (event) => {
        try {
          const payload = JSON.parse(event.nativeEvent.data) as {
            action?: string
            eventName?: string
            metadata?: { public_token?: string; status?: string }
          }
          const action = `${payload.action || ''} ${payload.eventName || ''}`.toLowerCase()
          const publicToken = payload.metadata?.public_token
          if (publicToken && (action.includes('connected') || action.includes('success'))) {
            await api.post('/api/plaid/exchange', { public_token: publicToken })
            await api.post('/api/plaid/sync')
            qc.invalidateQueries()
            navigation.goBack()
            return
          }
          if (action.includes('exit') || action.includes('close')) {
            navigation.goBack()
          }
        } catch {
          /* ignore non-JSON messages */
        }
      }}
    />
  )
}
