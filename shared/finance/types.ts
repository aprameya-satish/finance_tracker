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
  external_id: string
}

export type Category = {
  id: number
  name: string
  include_in_budget: boolean
  is_archived: boolean
}

export type Account = {
  id: number
  institution_id: number
  name: string
  last4: string | null
  kind: string
  institution: string
  is_active: boolean
  plaid_account_id: string | null
  plaid_item_id: number | null
}

export type Institution = {
  id: number
  name: string
}

export type MerchantRule = {
  merchant_norm: string
  category_id: number | null
  who: string
  hit_count: number
}

export type Budget = {
  id: number
  year_month: string
  category_id: number
  limit_cents: number
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

export type PlaidSnapshotAccount = {
  plaid_account_id: string
  plaid_item_id: number
  name: string
  last4: string | null
  kind: string
  institution: string
  is_active: boolean
}

export type PlaidSnapshotTransaction = {
  external_id: string
  plaid_account_id: string
  date: string
  description: string
  merchant_norm: string
  amount_cents: number
  txn_kind: string
  pending: boolean
  who: string
  who_source: string
  category: string | null
  category_source: string | null
  category_confidence: number | null
  notes: string | null
  plaid_pfc_primary: string | null
}

export type PlaidSnapshot = {
  items: PlaidItem[]
  accounts: PlaidSnapshotAccount[]
  transactions: PlaidSnapshotTransaction[]
}

export type ImportResult = {
  files: number
  rows_ok: number
  rows_skipped: number
  errors: string[]
}

export type ParsedRow = {
  txn_date: string
  description: string
  amount_cents: number
  category_name: string | null
  who: string
  notes: string | null
  txn_kind: string
  last4: string | null
  institution_name: string
  account_kind: string
  account_name: string
}

export type LocalState = {
  version: 1
  nextId: {
    institutions: number
    accounts: number
    categories: number
    transactions: number
    budgets: number
  }
  institutions: Institution[]
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  merchantRules: MerchantRule[]
  budgets: Budget[]
  settings: {
    person_a: string
    person_s: string
    csv_import_directory: string
    plaid_api_url: string
    plaid_api_key: string
  }
}

export function emptyState(): LocalState {
  return {
    version: 1,
    nextId: { institutions: 0, accounts: 0, categories: 0, transactions: 0, budgets: 0 },
    institutions: [],
    accounts: [],
    categories: [],
    transactions: [],
    merchantRules: [],
    budgets: [],
    settings: {
      person_a: 'Aprameya',
      person_s: 'Savanthi',
      csv_import_directory: '',
      plaid_api_url: '',
      plaid_api_key: '',
    },
  }
}

export function migrateState(state: LocalState): LocalState {
  if (!state.settings) state.settings = emptyState().settings
  if (state.settings.plaid_api_url == null) state.settings.plaid_api_url = ''
  if (state.settings.plaid_api_key == null) state.settings.plaid_api_key = ''
  if (state.settings.person_a == null) state.settings.person_a = 'Aprameya'
  if (state.settings.person_s == null) state.settings.person_s = 'Savanthi'
  if (state.settings.csv_import_directory == null) state.settings.csv_import_directory = ''
  for (const account of state.accounts) {
    if (account.plaid_account_id === undefined) account.plaid_account_id = null
    if (account.plaid_item_id === undefined) account.plaid_item_id = null
  }
  return state
}
