import { emptyState, migrateState, type LocalState } from './types.ts'

const STORAGE_KEY = 'finance-tracker-v1'

export type PersistAdapter = {
  load: () => Promise<string | null>
  save: (raw: string) => Promise<void>
}

export function memoryAdapter(): PersistAdapter {
  let value: string | null = null
  return {
    load: async () => value,
    save: async (raw) => {
      value = raw
    },
  }
}

export function localStorageAdapter(): PersistAdapter {
  return {
    load: async () => {
      try {
        return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
      } catch {
        return null
      }
    },
    save: async (raw) => {
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, raw)
      } catch {
        /* quota */
      }
    },
  }
}

export function indexedDbAdapter(): PersistAdapter {
  const dbName = 'finance-tracker'
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1)
      req.onupgradeneeded = () => req.result.createObjectStore('kv')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  return {
    load: async () => {
      try {
        const db = await open()
        return await new Promise<string | null>((resolve, reject) => {
          const req = db.transaction('kv').objectStore('kv').get(STORAGE_KEY)
          req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
          req.onerror = () => reject(req.error)
        })
      } catch {
        return localStorageAdapter().load()
      }
    },
    save: async (raw) => {
      try {
        const db = await open()
        await new Promise<void>((resolve, reject) => {
          const req = db.transaction('kv', 'readwrite').objectStore('kv').put(raw, STORAGE_KEY)
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        })
      } catch {
        await localStorageAdapter().save(raw)
      }
    },
  }
}

export function defaultAdapter(): PersistAdapter {
  if (typeof indexedDB !== 'undefined') return indexedDbAdapter()
  if (typeof localStorage !== 'undefined') return localStorageAdapter()
  return memoryAdapter()
}

export class FinanceStore {
  state: LocalState = emptyState()
  persist: PersistAdapter
  constructor(persist: PersistAdapter = defaultAdapter()) {
    this.persist = persist
  }

  async load() {
    const raw = await this.persist.load()
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as LocalState
      if (parsed?.version === 1) this.state = migrateState(parsed)
    } catch {
      /* keep empty */
    }
  }

  async save() {
    await this.persist.save(JSON.stringify(this.state))
  }

  exportJson() {
    return JSON.stringify(this.state, null, 2)
  }

  async importJson(raw: string) {
    const parsed = JSON.parse(raw) as LocalState
    if (parsed?.version !== 1) throw new Error('unsupported backup')
    this.state = migrateState(parsed)
    await this.save()
  }
}
