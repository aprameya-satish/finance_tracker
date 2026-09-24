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

export type ImportResult = {
  files: number
  rows_ok: number
  rows_skipped: number
  errors: string[]
}

export type Health = {
  ok: boolean
  plaid_configured: boolean
  db: string
}

export type InvestmentSummary = {
  as_of: string | null
  value_cents: number
  holdings: unknown[]
}
