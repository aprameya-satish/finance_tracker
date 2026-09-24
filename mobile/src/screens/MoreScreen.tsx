import { useNavigation } from '@react-navigation/native'
import { Text } from 'react-native'
import { Card, Eyebrow, Screen, Title } from '../components/ui'
import { colors } from '../theme'

const LINKS = [
  ['Review', 'Low-confidence queue'],
  ['Accounts', 'CSV upload'],
  ['Investments', 'Holdings harness'],
  ['Settings', 'People, API URL, categories'],
] as const

export default function MoreScreen() {
  const navigation = useNavigation<{ navigate: (name: (typeof LINKS)[number][0]) => void }>()
  return (
    <Screen>
      <Eyebrow>Finance</Eyebrow>
      <Title>More</Title>
      {LINKS.map(([name, detail]) => (
        <Card key={name} onPress={() => navigation.navigate(name)}>
          <Text style={{ color: colors.text, fontSize: 16 }}>{name}</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>{detail}</Text>
        </Card>
      ))}
    </Screen>
  )
}
