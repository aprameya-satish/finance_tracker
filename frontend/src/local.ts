import { createLocalClient } from '../../shared/finance/client.ts'
import { FinanceStore, defaultAdapter } from '../../shared/finance/store.ts'

export const financeStore = new FinanceStore(defaultAdapter())
export const localClient = createLocalClient(financeStore)

let loaded = false
let loading: Promise<void> | null = null

export function loadLocalFinance() {
  if (loaded) return Promise.resolve()
  if (!loading) {
    loading = financeStore.load().then(() => {
      loaded = true
    })
  }
  return loading
}
