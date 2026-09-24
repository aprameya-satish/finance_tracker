import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AppProvider, useApp } from './src/AppContext'
import RootNavigator from './src/navigation/RootNavigator'
import { colors } from './src/theme'

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    primary: colors.white,
  },
}

function ReadyApp() {
  const { ready } = useApp()
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.white} />
      </View>
    )
  }
  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <ReadyApp />
      </AppProvider>
    </SafeAreaProvider>
  )
}
