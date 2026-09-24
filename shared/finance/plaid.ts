import { inferTxnKind } from './csv.ts'
import { normalizeMerchant } from './merchant.ts'
import type {
  Account,
  LocalState,
  PlaidSnapshot,
  PlaidSnapshotAccount,
  PlaidSnapshotTransaction,
  Transaction,
} from './types.ts'

export const PLAID_PFC_MAP: Record<string, string> = {
  FOOD_AND_DRINK: 'Restaurants',
  GENERAL_MERCHANDISE: 'Shopping',
  RENT_AND_UTILITIES: 'Utilities',
  TRANSPORTATION: 'Auto',
  TRAVEL: 'Travel',
  ENTERTAINMENT: 'Entertainment',
  MEDICAL: 'Health',
  PERSONAL_CARE: 'Health',
  GENERAL_SERVICES: 'Administrative',
  GOVERNMENT_AND_NON_PROFIT: 'Administrative',
  BANK_FEES: 'Administrative',
  HOME_IMPROVEMENT: 'Home',
  LOAN_PAYMENTS: 'Mortgage',
  TRANSFER_IN: 'Transfer',
  TRANSFER_OUT: 'Transfer',
  INCOME: 'Income',
}

const NO_BUDGET = new Set(['investments', 'transfer', 'payment', 'credit card payment', 'income'])

export function normalizeApiUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

export function extractErrorDetail(text: string, fallback: string) {
  try {
    const parsed = JSON.parse(text) as { detail?: unknown }
    if (typeof parsed.detail === 'string' && parsed.detail) return parsed.detail
    if (Array.isArray(parsed.detail) && parsed.detail.length) return JSON.stringify(parsed.detail)
  } catch {
    /* raw text */
  }
  return text || fallback
}

export async function remotePlaidJson<T>(
  baseUrl: string,
  path: string,
  opts: { method?: string; body?: unknown; apiKey?: string; timeoutMs?: number } = {},
): Promise<T> {
  const root = normalizeApiUrl(baseUrl)
  if (!root) throw new Error('Set a hosted Plaid API URL in Settings first.')
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.apiKey) headers['X-Finance-Key'] = opts.apiKey
  const res = await fetch(`${root}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(extractErrorDetail(text, `${res.status} ${res.statusText}`))
  if (!text) return null as T
  return JSON.parse(text) as T
}

function nextId(state: LocalState, key: keyof LocalState['nextId']) {
  state.nextId[key] += 1
  return state.nextId[key]
}

function getOrCreateInstitution(state: LocalState, name: string) {
  const label = name || 'Plaid'
  let inst = state.institutions.find((i) => i.name === label)
  if (!inst) {
    inst = { id: nextId(state, 'institutions'), name: label }
    state.institutions.push(inst)
  }
  return inst
}

function getOrCreateCategory(state: LocalState, name: string) {
  let cat = state.categories.find((c) => c.name === name)
  if (!cat) {
    cat = {
      id: nextId(state, 'categories'),
      name,
      include_in_budget: !NO_BUDGET.has(name.trim().toLowerCase()),
      is_archived: false,
    }
    state.categories.push(cat)
  }
  return cat
}

export function matchPlaidAccount(state: LocalState, row: PlaidSnapshotAccount): Account {
  const byPlaid = state.accounts.find((a) => a.plaid_account_id && a.plaid_account_id === row.plaid_account_id)
  if (byPlaid) {
    byPlaid.name = row.name || byPlaid.name
    byPlaid.last4 = row.last4 ?? byPlaid.last4
    byPlaid.kind = row.kind || byPlaid.kind
    byPlaid.institution = row.institution || byPlaid.institution
    byPlaid.is_active = row.is_active
    byPlaid.plaid_item_id = row.plaid_item_id
    return byPlaid
  }
  const inst = getOrCreateInstitution(state, row.institution)
  const byMask = state.accounts.find(
    (a) => a.institution_id === inst.id && a.last4 && row.last4 && a.last4 === row.last4 && a.kind === row.kind,
  )
  if (byMask) {
    byMask.plaid_account_id = row.plaid_account_id
    byMask.plaid_item_id = row.plaid_item_id
    byMask.name = row.name || byMask.name
    byMask.is_active = row.is_active
    return byMask
  }
  const created: Account = {
    id: nextId(state, 'accounts'),
    institution_id: inst.id,
    name: row.name,
    last4: row.last4,
    kind: row.kind,
    institution: inst.name,
    is_active: row.is_active,
    plaid_account_id: row.plaid_account_id,
    plaid_item_id: row.plaid_item_id,
  }
  state.accounts.push(created)
  return created
}

function applyLocalRule(state: LocalState, txn: Transaction) {
  if (txn.category_source === 'user' && txn.who_source === 'user') return
  const exact = state.merchantRules.find((r) => r.merchant_norm === txn.merchant_norm)
  const rule =
    exact ||
    state.merchantRules.find(
      (r) => r.merchant_norm && txn.merchant_norm && (r.merchant_norm.includes(txn.merchant_norm) || txn.merchant_norm.includes(r.merchant_norm)),
    )
  if (!rule) return
  if (txn.category_source !== 'user' && rule.category_id) {
    txn.category_id = rule.category_id
    txn.category_source = 'rule'
    txn.category_confidence = exact ? 0.95 : 0.72
    txn.category = state.categories.find((c) => c.id === rule.category_id)?.name ?? txn.category
  }
  if (txn.who_source !== 'user') {
    txn.who = rule.who
    txn.who_source = 'rule'
  }
}

function applySnapshotLabels(state: LocalState, txn: Transaction, row: PlaidSnapshotTransaction) {
  if (txn.category_source !== 'user' && row.category) {
    const cat = getOrCreateCategory(state, row.category)
    txn.category_id = cat.id
    txn.category = cat.name
    txn.category_source = row.category_source
    txn.category_confidence = row.category_confidence
  }
  if (txn.who_source !== 'user' && row.who) {
    txn.who = row.who
    txn.who_source = row.who_source || 'imported'
  }
}

function applyPfcFallback(state: LocalState, txn: Transaction, pfc: string | null) {
  if (txn.category_source === 'user' || txn.category_id || !pfc) return
  const mapped = PLAID_PFC_MAP[pfc]
  if (!mapped) return
  const cat = getOrCreateCategory(state, mapped)
  txn.category_id = cat.id
  txn.category = cat.name
  txn.category_source = 'plaid_map'
  txn.category_confidence = 0.4
}

function upsertTransaction(state: LocalState, account: Account, row: PlaidSnapshotTransaction) {
  const merchant = row.merchant_norm || normalizeMerchant(row.description)
  const existing = state.transactions.find((t) => t.account_id === account.id && t.external_id === row.external_id)
  const kind = row.txn_kind || inferTxnKind(row.description, row.category, row.amount_cents, null)
  if (existing) {
    existing.amount_cents = row.amount_cents
    existing.date = row.date
    existing.description = row.description
    existing.merchant_norm = merchant
    existing.pending = row.pending
    existing.source = 'plaid'
    if (existing.who_source !== 'user') existing.txn_kind = kind
    applySnapshotLabels(state, existing, row)
    applyLocalRule(state, existing)
    applyPfcFallback(state, existing, row.plaid_pfc_primary)
    return 'updated'
  }
  const txn: Transaction = {
    id: nextId(state, 'transactions'),
    account_id: account.id,
    account_name: account.name,
    source: 'plaid',
    external_id: row.external_id,
    date: row.date,
    description: row.description,
    merchant_norm: merchant,
    amount_cents: row.amount_cents,
    txn_kind: kind,
    pending: row.pending,
    category_id: null,
    category: null,
    who: 'shared',
    who_source: 'imported',
    category_source: null,
    category_confidence: null,
    notes: row.notes,
  }
  applySnapshotLabels(state, txn, row)
  applyLocalRule(state, txn)
  applyPfcFallback(state, txn, row.plaid_pfc_primary)
  state.transactions.push(txn)
  return 'added'
}

export function ingestPlaidSnapshot(state: LocalState, snap: PlaidSnapshot) {
  const accountsByPlaid = new Map<string, Account>()
  for (const row of snap.accounts) {
    accountsByPlaid.set(row.plaid_account_id, matchPlaidAccount(state, row))
  }
  let added = 0
  let updated = 0
  const keep = new Set<string>()
  for (const row of snap.transactions) {
    const account = accountsByPlaid.get(row.plaid_account_id)
    if (!account) continue
    keep.add(`${account.id}:${row.external_id}`)
    if (upsertTransaction(state, account, row) === 'added') added += 1
    else updated += 1
  }
  const linkedIds = new Set(Array.from(accountsByPlaid.values(), (a) => a.id))
  const before = state.transactions.length
  state.transactions = state.transactions.filter((txn) => {
    if (txn.source !== 'plaid' || !linkedIds.has(txn.account_id)) return true
    return keep.has(`${txn.account_id}:${txn.external_id}`)
  })
  return {
    files: 0,
    rows_ok: added,
    rows_skipped: updated,
    removed: before - state.transactions.length,
    errors: [] as string[],
    items: snap.items.length,
    accounts: snap.accounts.length,
  }
}
