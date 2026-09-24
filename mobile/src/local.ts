import { createLocalClient } from '../../shared/finance/client.ts'
import { FinanceStore, type PersistAdapter } from '../../shared/finance/store.ts'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'finance-tracker-v1'

const asyncAdapter: PersistAdapter = {
  load: () => AsyncStorage.getItem(KEY),
  save: (raw) => AsyncStorage.setItem(KEY, raw),
}

export const financeStore = new FinanceStore(asyncAdapter)
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
