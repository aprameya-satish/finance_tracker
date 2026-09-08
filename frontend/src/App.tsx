import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Accounts from './pages/Accounts'
import Budgets from './pages/Budgets'
import Dashboard from './pages/Dashboard'
import Investments from './pages/Investments'
import Reports from './pages/Reports'
import Review from './pages/Review'
import SettingsPage from './pages/Settings'
import TransactionsPage from './pages/Transactions'

const client = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/review" element={<Review />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
