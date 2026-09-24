import { localClient, loadLocalFinance } from './local'
import type { ImportResult } from '../../shared/finance/types.ts'

const ready = () => loadLocalFinance()

export const api = {
  get: async <T,>(path: string) => {
    await ready()
    return (await localClient.get(path)) as T
  },
  post: async <T,>(path: string, body?: unknown) => {
    await ready()
    return (await localClient.post(path, body)) as T
  },
  put: async <T,>(path: string, body?: unknown) => {
    await ready()
    return (await localClient.put(path, body)) as T
  },
  patch: async <T,>(path: string, body?: unknown) => {
    await ready()
    return (await localClient.patch(path, body)) as T
  },
  upload: async <T,>(path: string, files: File[]) => {
    await ready()
    const payload = await Promise.all(
      files.map(async (file) => ({ name: file.name, text: await file.text() })),
    )
    return (await localClient.upload(path, payload)) as T
  },
}

export type { ImportResult }

export type Transaction = {
  id: number
  date: string
  description: string
  merchant_norm: string
  amount_cents: number
  txn_kind: string
  pending: boolean
  who: string
  who_source: string
  category_id: number | null
  category: string | null
  category_source: string | null
  category_confidence: number | null
  notes: string | null
  account_id: number
  account_name: string
  source: string
}

export type Category = {
  id: number
  name: string
  include_in_budget: boolean
  is_archived: boolean
}

export type Account = {
  id: number
  name: string
  last4: string | null
  kind: string
  institution: string
  is_active: boolean
  plaid_account_id?: string | null
  plaid_item_id?: number | null
}

export type BudgetRow = {
  category_id: number
  category: string
  limit_cents: number
  spent_cents: number
  delta_cents: number
  pct: number | null
  status: string
}

export type MonthReport = {
  year_month: string
  a_cents: number
  s_cents: number
  shared_cents: number
  aprameya_share_cents: number
  savanthi_share_cents: number
  total_cents: number
  uncategorized_cents: number
  parity_delta_cents: number
  categories: { category: string; A: number; S: number; shared: number; total: number }[]
  budgets: BudgetRow[]
}

export type Settings = {
  person_a: string
  person_s: string
  csv_import_directory: string
  plaid_configured: boolean
  plaid_env: string
  plaid_products: string[]
  plaid_api_url: string
  plaid_api_key: string
}

export type PlaidItem = {
  id: number
  item_id: string
  institution_name: string | null
  status: string
  products: string[]
  last_synced_at: string | null
}

export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
