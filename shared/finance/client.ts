import { importUploads } from './csv.ts'
import { copyBudgets, latestMonth, monthBudgetReport, monthSeries, splitTotals } from './reports.ts'
import { FinanceStore } from './store.ts'
import type { Account, Category, ImportResult, Settings, Transaction } from './types.ts'

function query(path: string) {
  return new URL(path, 'https://local.finance')
}

function flag(url: URL, key: string) {
  const v = url.searchParams.get(key)
  return v === 'true' || v === '1'
}

function hydrateTxn(store: FinanceStore, txn: Transaction): Transaction {
  const cat = store.state.categories.find((c) => c.id === txn.category_id)
  const acct = store.state.accounts.find((a) => a.id === txn.account_id)
  return { ...txn, category: cat?.name ?? null, account_name: acct?.name || txn.account_name }
}

export function createLocalClient(store: FinanceStore) {
  const save = () => store.save()

  const get = async (path: string): Promise<unknown> => {
    const url = query(path)
    const p = url.pathname
    if (p === '/api/health') return { ok: true, plaid_configured: false, db: 'on-device' }
    if (p === '/api/settings') {
      return {
        ...store.state.settings,
        plaid_configured: false,
        plaid_env: 'local',
        plaid_products: [],
      } satisfies Settings
    }
    if (p === '/api/categories') return store.state.categories
    if (p === '/api/accounts') return store.state.accounts.map((a) => ({ ...a, is_active: true }))
    if (p === '/api/plaid/items') return []
    if (p === '/api/investments/summary') return { as_of: null, value_cents: 0, holdings: [] }
    if (p === '/api/investments/holdings') return []
    if (p === '/api/reports/latest-month') return { year_month: latestMonth(store.state) }
    if (p === '/api/transactions') {
      let rows = store.state.transactions.map((t) => hydrateTxn(store, t))
      const ym = url.searchParams.get('year_month')
      const who = url.searchParams.get('who')
      const q = (url.searchParams.get('q') || '').toLowerCase()
      const accountId = url.searchParams.get('account_id')
      const categoryId = url.searchParams.get('category_id')
      const review = flag(url, 'review')
      if (ym) rows = rows.filter((t) => t.date.startsWith(ym))
      if (who) rows = rows.filter((t) => t.who === who)
      if (accountId) rows = rows.filter((t) => t.account_id === Number(accountId))
      if (categoryId) rows = rows.filter((t) => t.category_id === Number(categoryId))
      if (q) rows = rows.filter((t) => t.description.toLowerCase().includes(q))
      if (review) {
        rows = rows.filter((t) => !t.category_id || t.category_confidence == null || t.category_confidence < 0.75)
      }
      return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 2000)
    }
    const monthMatch = p.match(/^\/api\/reports\/month\/(\d{4}-\d{2})$/)
    if (monthMatch) return splitTotals(store.state, monthMatch[1], flag(url, 'include_pending'))
    const seriesMatch = p.match(/^\/api\/reports\/month\/(\d{4}-\d{2})\/series$/)
    if (seriesMatch) return monthSeries(store.state, seriesMatch[1], flag(url, 'include_pending'))
    const budgetMatch = p.match(/^\/api\/budgets\/(\d{4}-\d{2})$/)
    if (budgetMatch) return monthBudgetReport(store.state, budgetMatch[1], flag(url, 'include_pending'))
    throw new Error(`unknown GET ${p}`)
  }

  const post = async (path: string, body?: unknown): Promise<unknown> => {
    const url = query(path)
    const p = url.pathname
    if (p === '/api/transactions/bulk-who') {
      const payload = body as { ids: number[]; who: string; update_merchant_rule?: boolean }
      let n = 0
      for (const txn of store.state.transactions) {
        if (!payload.ids.includes(txn.id)) continue
        txn.who = payload.who
        txn.who_source = 'user'
        n += 1
      }
      await save()
      return { updated: n }
    }
    if (p === '/api/budgets/copy') {
      const payload = body as { from_month: string; to_month: string }
      const copied = copyBudgets(store.state, payload.from_month, payload.to_month)
      await save()
      return { copied }
    }
    if (p === '/api/imports/directory') {
      throw new Error('Folder import needs a computer. Use Upload CSVs on this phone instead.')
    }
    if (p.startsWith('/api/plaid/')) {
      throw new Error('Plaid linking needs a hosted backend. Upload CSVs on this phone instead.')
    }
    throw new Error(`unknown POST ${p}`)
  }

  const put = async (path: string, body?: unknown): Promise<unknown> => {
    const p = query(path).pathname
    if (p === '/api/settings') {
      const payload = body as Partial<Settings>
      if (payload.person_a != null) store.state.settings.person_a = payload.person_a
      if (payload.person_s != null) store.state.settings.person_s = payload.person_s
      if (payload.csv_import_directory != null) store.state.settings.csv_import_directory = payload.csv_import_directory
      await save()
      return get('/api/settings')
    }
    if (p === '/api/budgets') {
      const payload = body as { year_month: string; category_id: number; limit_cents: number }
      const existing = store.state.budgets.find((b) => b.year_month === payload.year_month && b.category_id === payload.category_id)
      if (existing) existing.limit_cents = payload.limit_cents
      else {
        store.state.nextId.budgets += 1
        store.state.budgets.push({ id: store.state.nextId.budgets, ...payload })
      }
      await save()
      return { ok: true }
    }
    throw new Error(`unknown PUT ${p}`)
  }

  const patch = async (path: string, body?: unknown): Promise<unknown> => {
    const p = query(path).pathname
    const txnMatch = p.match(/^\/api\/transactions\/(\d+)$/)
    if (txnMatch) {
      const txn = store.state.transactions.find((t) => t.id === Number(txnMatch[1]))
      if (!txn) throw new Error('transaction not found')
      const payload = body as { who?: string; category_id?: number; notes?: string }
      if (payload.who) {
        txn.who = payload.who
        txn.who_source = 'user'
      }
      if (payload.category_id != null) {
        txn.category_id = payload.category_id
        txn.category_source = 'user'
        txn.category_confidence = 1
        txn.category = store.state.categories.find((c) => c.id === payload.category_id)?.name ?? null
      }
      if (payload.notes != null) txn.notes = payload.notes
      await save()
      return hydrateTxn(store, txn)
    }
    const catMatch = p.match(/^\/api\/categories\/(\d+)$/)
    if (catMatch) {
      const cat = store.state.categories.find((c) => c.id === Number(catMatch[1]))
      if (!cat) throw new Error('category not found')
      const payload = body as Partial<Category>
      if (payload.include_in_budget != null) cat.include_in_budget = payload.include_in_budget
      if (payload.name) cat.name = payload.name
      await save()
      return cat
    }
    throw new Error(`unknown PATCH ${p}`)
  }

  const upload = async (path: string, files: { name: string; text: string }[]): Promise<ImportResult> => {
    if (query(path).pathname !== '/api/imports/upload') throw new Error('unknown upload')
    const result = await importUploads(store.state, files)
    await save()
    return result
  }

  return { get, post, put, patch, upload, store }
}

export type LocalClient = ReturnType<typeof createLocalClient>

export function accountOut(a: Account) {
  return a
}
