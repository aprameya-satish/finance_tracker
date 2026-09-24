import { localClient, loadLocalFinance } from './local'
import type { UploadFile } from './legacyTypes'

const ready = () => loadLocalFinance()

async function fileToText(file: UploadFile) {
  const res = await fetch(file.uri)
  return { name: file.name, text: await res.text() }
}

export const api = {
  root: 'local',
  get: async <T,>(path: string) => {
    await ready()
    return (await localClient.get(path)) as T
  },
  post: async <T,>(path: string, body?: unknown) => {
    await ready()
    return (await localClient.post(path, body)) as T
  },
  put: async <T,>(path: string, body?: unknown) => {
    await ready()
    return (await localClient.put(path, body)) as T
  },
  patch: async <T,>(path: string, body?: unknown) => {
    await ready()
    return (await localClient.patch(path, body)) as T
  },
  upload: async <T,>(path: string, files: UploadFile[]) => {
    await ready()
    const payload = await Promise.all(files.map(fileToText))
    return (await localClient.upload(path, payload)) as T
  },
}

export type { UploadFile }

export function suggestedApiBaseUrl() {
  return 'local'
}

export async function loadApiBaseUrl() {
  return 'local'
}

export async function saveApiBaseUrl(_url: string) {
  return
}

export function createApi(_baseUrl: string) {
  return api
}
