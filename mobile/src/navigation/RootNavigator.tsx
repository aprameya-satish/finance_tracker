import { Ionicons } from '@expo/vector-icons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import AccountsScreen from '../screens/AccountsScreen'
import ActivityScreen from '../screens/ActivityScreen'
import BudgetsScreen from '../screens/BudgetsScreen'
import InvestmentsScreen from '../screens/InvestmentsScreen'
import MoreScreen from '../screens/MoreScreen'
import OverviewScreen from '../screens/OverviewScreen'
import PlaidLinkScreen from '../screens/PlaidLinkScreen'
import ReviewScreen from '../screens/ReviewScreen'
import SettingsScreen from '../screens/SettingsScreen'
import SplitScreen from '../screens/SplitScreen'
import { colors } from '../theme'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function MoreStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="MoreHome" component={MoreScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Review" component={ReviewScreen} options={{ title: 'Review' }} />
      <Stack.Screen name="Accounts" component={AccountsScreen} options={{ title: 'Accounts' }} />
      <Stack.Screen name="Investments" component={InvestmentsScreen} options={{ title: 'Investments' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="PlaidLink" component={PlaidLinkScreen} options={{ title: 'Link account' }} />
    </Stack.Navigator>
  )
}

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Overview: 'home-outline',
            Activity: 'list-outline',
            Budgets: 'pie-chart-outline',
            Split: 'people-outline',
            More: 'ellipsis-horizontal',
          }
          return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Overview" component={OverviewScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Budgets" component={BudgetsScreen} />
      <Tab.Screen name="Split" component={SplitScreen} />
      <Tab.Screen name="More" component={MoreStack} />
    </Tab.Navigator>
  )
}
