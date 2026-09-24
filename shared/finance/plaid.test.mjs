import { ingestPlaidSnapshot } from './plaid.ts'
import { emptyState } from './types.ts'

function snapshot() {
  return {
    items: [{ id: 1, item_id: 'item-1', institution_name: 'Chase', status: 'active', products: ['transactions'], last_synced_at: null }],
    accounts: [
      {
        plaid_account_id: 'plaid-acc-1',
        plaid_item_id: 1,
        name: 'Chase Sapphire',
        last4: '1561',
        kind: 'credit',
        institution: 'Chase',
        is_active: true,
      },
    ],
    transactions: [
      {
        external_id: 'txn-1',
        plaid_account_id: 'plaid-acc-1',
        date: '2026-04-01',
        description: 'WHOLEFDS ATL',
        merchant_norm: 'WHOLEFDS ATL',
        amount_cents: 1295,
        txn_kind: 'spend',
        pending: false,
        who: 'shared',
        who_source: 'rule',
        category: 'Groceries',
        category_source: 'model',
        category_confidence: 0.8,
        notes: null,
        plaid_pfc_primary: 'FOOD_AND_DRINK',
      },
    ],
  }
}

const first = emptyState()
const added = ingestPlaidSnapshot(first, snapshot())
if (added.rows_ok !== 1) throw new Error(`added ${added.rows_ok}`)
if (first.accounts[0].plaid_account_id !== 'plaid-acc-1') throw new Error('account id')
if (first.transactions[0].category !== 'Groceries') throw new Error('category')

first.transactions[0].who = 'A'
first.transactions[0].who_source = 'user'
first.transactions[0].category = 'Dining'
first.transactions[0].category_source = 'user'
first.transactions[0].category_id = 99
const again = ingestPlaidSnapshot(first, snapshot())
if (again.rows_skipped !== 1) throw new Error(`updated ${again.rows_skipped}`)
if (first.transactions[0].who !== 'A' || first.transactions[0].who_source !== 'user') throw new Error('who overwritten')
if (first.transactions[0].category_source !== 'user' || first.transactions[0].category_id !== 99) {
  throw new Error('category overwritten')
}

const linked = emptyState()
linked.nextId.institutions = 1
linked.nextId.accounts = 1
linked.institutions.push({ id: 1, name: 'Chase' })
linked.accounts.push({
  id: 1,
  institution_id: 1,
  name: 'Chase 1561',
  last4: '1561',
  kind: 'credit',
  institution: 'Chase',
  is_active: true,
  plaid_account_id: null,
  plaid_item_id: null,
})
ingestPlaidSnapshot(linked, snapshot())
if (linked.accounts.length !== 1) throw new Error('should reuse last4 account')
if (linked.accounts[0].plaid_account_id !== 'plaid-acc-1') throw new Error('link last4')

const drop = snapshot()
drop.transactions = []
const removed = ingestPlaidSnapshot(first, drop)
if (removed.removed !== 1) throw new Error(`removed ${removed.removed}`)
if (first.transactions.length !== 0) throw new Error('stale plaid txn stayed')

console.log('shared plaid ingest ok')
