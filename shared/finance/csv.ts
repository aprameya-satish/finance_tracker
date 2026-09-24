import { dollarsToCents } from './money.ts'
import { csvFingerprint, normalizeMerchant, parseWho } from './merchant.ts'
import type { ImportResult, LocalState, ParsedRow, Transaction } from './types.ts'

const NO_BUDGET = new Set(['investments', 'transfer', 'payment', 'credit card payment'])
const INVESTMENT_HINTS = ['ROBINHOOD', 'FIDELITY', 'VANGUARD', 'SCHWAB', 'COINBASE', 'WEALTHFRONT']
const FILENAME_LAST4 = /(chase|amex)(\d{4})/i

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      if (cell.endsWith('\r')) cell = cell.slice(0, -1)
      row.push(cell)
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell.length || row.length) {
    row.push(cell)
    if (row.some((c) => c.trim())) rows.push(row)
  }
  return rows
}

export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (!rows.length) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((line) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (line[i] ?? '').trim()
    })
    return obj
  })
}

function parseDate(value: string): string {
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) throw new Error(`unreadable date: ${value}`)
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function detectParser(filename: string, columns: string[]): string {
  const cols = new Set(columns.map((c) => c.trim()))
  const name = filename.toLowerCase()
  if (name.includes('home_utilities')) return 'utilities_manual'
  if (cols.has('Card Member') || cols.has('Account #')) return 'amex'
  if (cols.has('Details') && cols.has('Balance')) return 'chase_bank'
  if (cols.has('Transaction Date')) return 'chase_credit'
  throw new Error(`unknown CSV schema for ${filename}: ${[...cols].sort().join(',')}`)
}

function last4FromName(filename: string): string | null {
  const m = FILENAME_LAST4.exec(filename)
  return m ? m[2] : null
}

function institutionFromName(filename: string, parser: string): string {
  const m = FILENAME_LAST4.exec(filename)
  if (m) return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
  return parser === 'utilities_manual' ? 'Manual' : 'Unknown'
}

export function inferTxnKind(description: string, categoryName: string | null, amountCents: number, typeValue: string | null) {
  const desc = (description || '').toUpperCase()
  const typ = (typeValue || '').toUpperCase()
  const cat = (categoryName || '').trim().toLowerCase()
  if (cat === 'investments' || INVESTMENT_HINTS.some((h) => desc.includes(h))) return 'investment_contribution'
  if (typ === 'PAYMENT' || typ === 'ACCT_XFER' || typ === 'TRANSFER' || desc.includes('AUTOPAY PAYMENT') || desc.includes('PAYMENT THANK YOU')) {
    return 'payment'
  }
  if (typ === 'RETURN' || typ === 'REFUND' || typ === 'CREDIT') return 'refund'
  if (amountCents < 0) return 'refund'
  return 'spend'
}

function opt(value: string | undefined): string | null {
  const text = (value || '').trim()
  return text || null
}

export function parseRows(filename: string, objects: Record<string, string>[]): { parser: string; rows: ParsedRow[] } {
  const parser = detectParser(filename, objects[0] ? Object.keys(objects[0]) : [])
  let last4 = last4FromName(filename)
  const inst = institutionFromName(filename, parser)
  const rows: ParsedRow[] = objects.map((r) => {
    if (parser === 'chase_credit') {
      const cents = -dollarsToCents(r.Amount)
      const desc = (r.Description || '').trim()
      const cat = opt(r.Category)
      return {
        txn_date: parseDate(r['Transaction Date'] || r['Post Date']),
        description: desc,
        amount_cents: cents,
        category_name: cat,
        who: parseWho(r.Who),
        notes: opt(r.Notes || r.Note),
        txn_kind: inferTxnKind(desc, cat, cents, opt(r.Type)),
        last4,
        institution_name: inst,
        account_kind: 'credit',
        account_name: `${inst} ${last4 || 'card'}`,
      }
    }
    if (parser === 'chase_bank') {
      const cents = -dollarsToCents(r.Amount)
      const desc = (r.Description || '').trim()
      const cat = opt(r.Category)
      return {
        txn_date: parseDate(r['Posting Date'] || r.Date),
        description: desc,
        amount_cents: cents,
        category_name: cat,
        who: parseWho(r.Who),
        notes: null,
        txn_kind: inferTxnKind(desc, cat, cents, opt(r.Type)),
        last4,
        institution_name: inst,
        account_kind: 'depository',
        account_name: `Chase checking ${last4 || ''}`.trim(),
      }
    }
    if (parser === 'amex') {
      const cents = dollarsToCents(r.Amount)
      const desc = (r.Description || '').trim()
      const cat = opt(r.Category)
      if (!last4) {
        const digits = (r['Account #'] || '').replace(/\D/g, '')
        last4 = digits.slice(-4) || null
      }
      return {
        txn_date: parseDate(r.Date),
        description: desc,
        amount_cents: cents,
        category_name: cat,
        who: parseWho(r.Who),
        notes: null,
        txn_kind: inferTxnKind(desc, cat, cents, null),
        last4,
        institution_name: 'Amex',
        account_kind: 'credit',
        account_name: `Amex ${last4 || 'card'}`,
      }
    }
    const cents = -dollarsToCents(r.Amount)
    const desc = (r.Description || '').trim()
    const cat = opt(r.Category)
    return {
      txn_date: parseDate(r.Date),
      description: desc,
      amount_cents: cents,
      category_name: cat,
      who: parseWho(r.Who),
      notes: opt(r.Note || r.Notes),
      txn_kind: inferTxnKind(desc, cat, cents, null),
      last4: null,
      institution_name: 'Manual',
      account_kind: 'manual',
      account_name: 'Home utilities',
    }
  })
  return { parser, rows }
}

function nextId(state: LocalState, key: keyof LocalState['nextId']) {
  state.nextId[key] += 1
  return state.nextId[key]
}

function getOrCreateInstitution(state: LocalState, name: string) {
  let inst = state.institutions.find((i) => i.name === name)
  if (!inst) {
    inst = { id: nextId(state, 'institutions'), name }
    state.institutions.push(inst)
  }
  return inst
}

function getOrCreateAccount(state: LocalState, row: ParsedRow) {
  const inst = getOrCreateInstitution(state, row.institution_name)
  let acct = state.accounts.find((a) => a.institution_id === inst.id && a.last4 === row.last4 && a.kind === row.account_kind)
  if (!acct) {
    acct = {
      id: nextId(state, 'accounts'),
      institution_id: inst.id,
      name: row.account_name,
      last4: row.last4,
      kind: row.account_kind,
      institution: inst.name,
      is_active: true,
      plaid_account_id: null,
      plaid_item_id: null,
    }
    state.accounts.push(acct)
  }
  return acct
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

export function rebuildMerchantRules(state: LocalState) {
  const votes = new Map<string, Map<string, number>>()
  for (const txn of state.transactions) {
    if (!txn.category_id || !txn.merchant_norm) continue
    const key = `${txn.category_id}|${txn.who}`
    if (!votes.has(txn.merchant_norm)) votes.set(txn.merchant_norm, new Map())
    const bucket = votes.get(txn.merchant_norm)!
    bucket.set(key, (bucket.get(key) || 0) + 1)
  }
  state.merchantRules = []
  for (const [merchant, bucket] of votes) {
    let best = ''
    let hits = 0
    for (const [key, count] of bucket) {
      if (count > hits) {
        best = key
        hits = count
      }
    }
    const [category_id, who] = best.split('|')
    state.merchantRules.push({
      merchant_norm: merchant,
      category_id: Number(category_id),
      who,
      hit_count: hits,
    })
  }
}

function applyPrediction(state: LocalState, txn: Transaction) {
  if (txn.category_source === 'user' && txn.who_source === 'user') return
  const exact = state.merchantRules.find((r) => r.merchant_norm === txn.merchant_norm)
  const rule =
    exact ||
    state.merchantRules.find((r) => r.merchant_norm && txn.merchant_norm && (r.merchant_norm.includes(txn.merchant_norm) || txn.merchant_norm.includes(r.merchant_norm)))
  if (!rule) return
  if (txn.category_source !== 'user' && rule.category_id) {
    txn.category_id = rule.category_id
    txn.category_source = 'rule'
    txn.category_confidence = exact ? 0.95 : 0.72
  }
  if (txn.who_source !== 'user') {
    txn.who = rule.who
    txn.who_source = 'rule'
  }
}

export async function persistParsed(state: LocalState, filename: string, _parser: string, rows: ParsedRow[]) {
  let rows_ok = 0
  let rows_skipped = 0
  const errors: string[] = []
  for (const row of rows) {
    try {
      const account = getOrCreateAccount(state, row)
      const external_id = await csvFingerprint(row.last4, row.txn_date, row.amount_cents, row.description)
      const existing = state.transactions.find((t) => t.account_id === account.id && t.external_id === external_id)
      const category = row.category_name ? getOrCreateCategory(state, row.category_name) : null
      if (existing) {
        if (existing.who_source !== 'user') {
          existing.who = row.who
          existing.who_source = 'imported'
        }
        if (existing.category_source !== 'user' && category) {
          existing.category_id = category.id
          existing.category_source = 'imported'
          existing.category_confidence = 1
        }
        existing.amount_cents = row.amount_cents
        existing.date = row.txn_date
        existing.description = row.description
        existing.merchant_norm = normalizeMerchant(row.description)
        existing.txn_kind = row.txn_kind
        existing.notes = row.notes || existing.notes
        rows_skipped += 1
        continue
      }
      const txn: Transaction = {
        id: nextId(state, 'transactions'),
        account_id: account.id,
        account_name: account.name,
        source: 'csv',
        external_id,
        date: row.txn_date,
        description: row.description,
        merchant_norm: normalizeMerchant(row.description),
        amount_cents: row.amount_cents,
        txn_kind: row.txn_kind,
        pending: false,
        category_id: category?.id ?? null,
        category: category?.name ?? null,
        who: row.who,
        who_source: 'imported',
        category_source: category ? 'imported' : null,
        category_confidence: category ? 1 : null,
        notes: row.notes,
      }
      if (!txn.category_id) applyPrediction(state, txn)
      state.transactions.push(txn)
      rows_ok += 1
    } catch (err) {
      errors.push(`${filename}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  rebuildMerchantRules(state)
  return { rows_ok, rows_skipped, errors }
}

export async function importUploads(state: LocalState, files: { name: string; text: string }[]): Promise<ImportResult> {
  const result: ImportResult = { files: 0, rows_ok: 0, rows_skipped: 0, errors: [] }
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      result.errors.push(`${file.name}: only .csv files are accepted`)
      continue
    }
    result.files += 1
    try {
      const objects = rowsToObjects(parseCsvText(file.text))
      if (!objects.length) throw new Error('empty CSV')
      const { parser, rows } = parseRows(file.name, objects)
      const batch = await persistParsed(state, file.name, parser, rows)
      result.rows_ok += batch.rows_ok
      result.rows_skipped += batch.rows_skipped
      result.errors.push(...batch.errors)
    } catch (err) {
      result.errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return result
}
