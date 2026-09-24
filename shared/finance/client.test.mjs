import { createLocalClient } from './client.ts'
import { FinanceStore, memoryAdapter } from './store.ts'

const store = new FinanceStore(memoryAdapter())
await store.load()
const client = createLocalClient(store)

try {
  await client.post('/api/plaid/sync')
  throw new Error('expected hosted-url error')
} catch (err) {
  if (!String(err.message).includes('hosted')) throw err
}

await client.put('/api/settings', { plaid_api_url: 'https://api.example', plaid_api_key: 'secret' })
if (store.state.settings.plaid_api_url !== 'https://api.example') throw new Error('url not saved')
if (store.state.settings.plaid_api_key !== 'secret') throw new Error('key not saved')

const snap = {
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

const calls = []
globalThis.fetch = async (url, init = {}) => {
  const path = String(url)
  calls.push({ path, method: init.method || 'GET', key: init.headers?.['X-Finance-Key'] })
  if (path.endsWith('/api/plaid/sync')) return new Response(JSON.stringify({ added: 1 }), { status: 200 })
  if (path.endsWith('/api/plaid/snapshot')) return new Response(JSON.stringify(snap), { status: 200 })
  if (path.endsWith('/api/settings')) {
    return new Response(
      JSON.stringify({
        person_a: 'Aprameya',
        person_s: 'Savanthi',
        csv_import_directory: '',
        plaid_configured: true,
        plaid_env: 'sandbox',
        plaid_products: ['transactions'],
      }),
      { status: 200 },
    )
  }
  return new Response('missing', { status: 404 })
}

const result = await client.post('/api/plaid/sync')
if (!result.snapshot || result.snapshot.rows_ok !== 1) throw new Error(`sync ingest ${JSON.stringify(result)}`)
if (store.state.transactions.length !== 1) throw new Error('txn missing')
if (store.state.transactions[0].who_source === 'user') throw new Error('should not be user')
if (!calls.some((c) => c.path.endsWith('/api/plaid/snapshot') && c.key === 'secret')) throw new Error('key not sent')

const settings = await client.get('/api/settings')
if (!settings.plaid_configured || settings.plaid_env !== 'sandbox') throw new Error('probe failed')
if (settings.plaid_api_url !== 'https://api.example') throw new Error('local url lost')

console.log('shared plaid client ok')
