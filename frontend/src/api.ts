const json = async <T,>(res: Response): Promise<T> => {
  if (!res.ok) {
    const text = await res.text()
    try {
      const parsed = JSON.parse(text) as { detail?: string }
      if (typeof parsed.detail === 'string') throw new Error(parsed.detail)
    } catch (err) {
      if (err instanceof SyntaxError) throw new Error(text || res.statusText)
      throw err
    }
    throw new Error(text || res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  get: <T,>(path: string) => fetch(path).then((r) => json<T>(r)),
  post: <T,>(path: string, body?: unknown) =>
    fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => json<T>(r)),
  put: <T,>(path: string, body?: unknown) =>
    fetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => json<T>(r)),
  patch: <T,>(path: string, body?: unknown) =>
    fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => json<T>(r)),
  upload: <T,>(path: string, files: File[]) => {
    const body = new FormData()
    for (const file of files) body.append('files', file)
    return fetch(path, { method: 'POST', body }).then((r) => json<T>(r))
  },
}

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
}

export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
