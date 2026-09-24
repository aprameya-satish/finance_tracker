import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'finance.apiBaseUrl'

export function suggestedApiBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.linkingUri || ''
  const host = hostUri.replace(/^[a-z]+:\/\//, '').split(':')[0].split('/')[0]
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:8000`
  }
  return 'http://127.0.0.1:8000'
}

export async function loadApiBaseUrl() {
  const stored = await AsyncStorage.getItem(STORAGE_KEY)
  return stored || suggestedApiBaseUrl()
}

export async function saveApiBaseUrl(url: string) {
  await AsyncStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ''))
}

export type UploadFile = {
  uri: string
  name: string
  type?: string
}

async function parseError(res: Response) {
  const text = await res.text()
  try {
    const parsed = JSON.parse(text) as { detail?: string }
    if (typeof parsed.detail === 'string') return parsed.detail
  } catch {
    /* use raw text */
  }
  return text || res.statusText
}

export function createApi(baseUrl: string) {
  const root = baseUrl.replace(/\/$/, '')

  const json = async <T,>(res: Response): Promise<T> => {
    if (!res.ok) throw new Error(await parseError(res))
    return res.json() as Promise<T>
  }

  return {
    root,
    get: <T,>(path: string) => fetch(`${root}${path}`).then((r) => json<T>(r)),
    post: <T,>(path: string, body?: unknown) =>
      fetch(`${root}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      }).then((r) => json<T>(r)),
    put: <T,>(path: string, body?: unknown) =>
      fetch(`${root}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      }).then((r) => json<T>(r)),
    patch: <T,>(path: string, body?: unknown) =>
      fetch(`${root}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      }).then((r) => json<T>(r)),
    upload: <T,>(path: string, files: UploadFile[]) => {
      const body = new FormData()
      for (const file of files) {
        body.append('files', {
          uri: file.uri,
          name: file.name,
          type: file.type || 'text/csv',
        } as unknown as Blob)
      }
      return fetch(`${root}${path}`, { method: 'POST', body }).then((r) => json<T>(r))
    },
  }
}

export type ApiClient = ReturnType<typeof createApi>
