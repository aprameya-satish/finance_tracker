import type { BudgetRow, LocalState, MonthReport, Transaction } from './types.ts'

const SPEND_KINDS = new Set(['spend', 'refund', 'investment_contribution'])

function monthBounds(yearMonth: string) {
  const [y, m] = yearMonth.split('-').map(Number)
  const start = `${yearMonth}-01`
  const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { start, end: endDate }
}

export function monthTransactions(state: LocalState, yearMonth: string, includePending = false): Transaction[] {
  const { start, end } = monthBounds(yearMonth)
  return state.transactions.filter((t) => {
    if (t.date < start || t.date >= end) return false
    if (!SPEND_KINDS.has(t.txn_kind)) return false
    if (!includePending && t.pending) return false
    return true
  })
}

export function budgetStatus(spent: number, limitCents: number) {
  if (limitCents <= 0) return 'ok'
  const pct = spent / limitCents
  if (pct > 1) return 'over'
  if (pct >= 0.8) return 'watch'
  return 'ok'
}

export function monthBudgetReport(state: LocalState, yearMonth: string, includePending = false): BudgetRow[] {
  const spentMap = new Map<number, number>()
  for (const txn of monthTransactions(state, yearMonth, includePending)) {
    if (!txn.category_id) continue
    const cat = state.categories.find((c) => c.id === txn.category_id)
    if (cat && !cat.include_in_budget) continue
    spentMap.set(txn.category_id, (spentMap.get(txn.category_id) || 0) + txn.amount_cents)
  }
  const rows: BudgetRow[] = []
  const seen = new Set<number>()
  for (const b of state.budgets.filter((x) => x.year_month === yearMonth)) {
    const spent = spentMap.get(b.category_id) || 0
    const cat = state.categories.find((c) => c.id === b.category_id)
    rows.push({
      category_id: b.category_id,
      category: cat?.name || '',
      limit_cents: b.limit_cents,
      spent_cents: spent,
      delta_cents: b.limit_cents - spent,
      pct: b.limit_cents ? Math.round((spent / b.limit_cents) * 10000) / 10000 : null,
      status: budgetStatus(spent, b.limit_cents),
    })
    seen.add(b.category_id)
  }
  for (const [catId, spent] of spentMap) {
    if (seen.has(catId)) continue
    const cat = state.categories.find((c) => c.id === catId)
    rows.push({
      category_id: catId,
      category: cat?.name || '',
      limit_cents: 0,
      spent_cents: spent,
      delta_cents: -spent,
      pct: null,
      status: 'unbudgeted',
    })
  }
  rows.sort((a, b) => {
    const rank = (s: string) => (s === 'over' ? 0 : s === 'watch' ? 1 : 2)
    return rank(a.status) - rank(b.status) || a.category.localeCompare(b.category)
  })
  return rows
}

export function splitTotals(state: LocalState, yearMonth: string, includePending = false): MonthReport {
  const buckets = { A: 0, S: 0, shared: 0 }
  const byCategory = new Map<string, { A: number; S: number; shared: number; total: number }>()
  let uncategorized = 0
  for (const txn of monthTransactions(state, yearMonth, includePending)) {
    const who = txn.who === 'A' || txn.who === 'S' ? txn.who : 'shared'
    buckets[who] += txn.amount_cents
    const name = txn.category || 'Uncategorized'
    if (!byCategory.has(name)) byCategory.set(name, { A: 0, S: 0, shared: 0, total: 0 })
    const row = byCategory.get(name)!
    row[who] += txn.amount_cents
    row.total += txn.amount_cents
    if (!txn.category_id) uncategorized += txn.amount_cents
  }
  const a = buckets.A
  const s = buckets.S
  const shared = buckets.shared
  const categories = [...byCategory.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((x, y) => y.total - x.total)
  const catSum = categories.reduce((n, r) => n + r.total, 0)
  return {
    year_month: yearMonth,
    a_cents: a,
    s_cents: s,
    shared_cents: shared,
    aprameya_share_cents: a + Math.floor(shared / 2),
    savanthi_share_cents: s + (shared - Math.floor(shared / 2)),
    total_cents: a + s + shared,
    uncategorized_cents: uncategorized,
    parity_delta_cents: catSum - (a + s + shared),
    categories,
    budgets: monthBudgetReport(state, yearMonth, includePending),
  }
}

export function monthSeries(state: LocalState, yearMonth: string, includePending = false, topN = 7) {
  const { start, end } = monthBounds(yearMonth)
  const txns = monthTransactions(state, yearMonth, includePending)
  const totals = new Map<string, number>()
  const dailyCat = new Map<string, Map<string, number>>()
  for (const txn of txns) {
    const name = txn.category || 'Uncategorized'
    totals.set(name, (totals.get(name) || 0) + txn.amount_cents)
    if (!dailyCat.has(txn.date)) dailyCat.set(txn.date, new Map())
    const day = dailyCat.get(txn.date)!
    day.set(name, (day.get(name) || 0) + txn.amount_cents)
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  const top = ranked.slice(0, topN)
  const rest = ranked.slice(topN)
  const labels = rest.length ? [...top, 'Other'] : top
  const days: string[] = []
  let cursor = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  while (cursor < endDate) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  const running: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]))
  const daily = days.map((date) => {
    const dayMap = dailyCat.get(date) || new Map()
    const row: Record<string, string | number> = { date, day: Number(date.slice(8)), total_cents: 0 }
    for (const lab of top) {
      const cents = dayMap.get(lab) || 0
      row[lab] = cents
      row.total_cents = Number(row.total_cents) + cents
      running[lab] += cents
    }
    if (rest.length) {
      const other = rest.reduce((n, name) => n + (dayMap.get(name) || 0), 0)
      row.Other = other
      row.total_cents = Number(row.total_cents) + other
      running.Other += other
    }
    return row
  })
  const cumulative = days.map((date, i) => {
    const crow: Record<string, string | number> = { date, day: Number(date.slice(8)), total_cents: 0 }
    // rebuild running up to i
    const run: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]))
    for (let j = 0; j <= i; j++) {
      for (const lab of labels) run[lab] += Number(daily[j][lab] || 0)
    }
    Object.assign(crow, run)
    crow.total_cents = labels.reduce((n, lab) => n + run[lab], 0)
    return crow
  })
  return { year_month: yearMonth, categories: labels, daily, cumulative }
}

export function latestMonth(state: LocalState): string {
  if (!state.transactions.length) return new Date().toISOString().slice(0, 7)
  return state.transactions.reduce((max, t) => (t.date > max ? t.date : max), state.transactions[0].date).slice(0, 7)
}

export function copyBudgets(state: LocalState, fromMonth: string, toMonth: string) {
  const existing = new Set(state.budgets.filter((b) => b.year_month === toMonth).map((b) => b.category_id))
  let n = 0
  for (const b of state.budgets.filter((x) => x.year_month === fromMonth)) {
    if (existing.has(b.category_id)) continue
    state.nextId.budgets += 1
    state.budgets.push({
      id: state.nextId.budgets,
      year_month: toMonth,
      category_id: b.category_id,
      limit_cents: b.limit_cents,
    })
    n += 1
  }
  return n
}
