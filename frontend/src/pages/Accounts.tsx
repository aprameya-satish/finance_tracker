import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { api, type Account, type Settings } from '../api'

type PlaidItem = {
  id: number
  item_id: string
  institution_name: string | null
  status: string
  products: string[]
  last_synced_at: string | null
}

type ImportResult = {
  files: number
  rows_ok: number
  rows_skipped: number
  errors: string[]
}

function formatImportResult(data: ImportResult) {
  const summary = `Imported ${data.files} files · ${data.rows_ok} new · ${data.rows_skipped} existing`
  return data.errors.length ? `${summary} · ${data.errors.length} issue(s): ${data.errors.slice(0, 3).join('; ')}` : summary
}

function PlaidConnect() {
  const qc = useQueryClient()
  const [token, setToken] = useState<string | null>(null)
  const onSuccess = useCallback(async (public_token: string | null) => {
    if (!public_token) return
    await api.post('/api/plaid/exchange', { public_token })
    await api.post('/api/plaid/sync')
    qc.invalidateQueries({ queryKey: ['accounts'] })
    qc.invalidateQueries({ queryKey: ['plaid-items'] })
    qc.invalidateQueries({ queryKey: ['txns'] })
  }, [qc])
  const { open, ready } = usePlaidLink({ token, onSuccess })

  useEffect(() => {
    if (token && ready) open()
  }, [token, ready, open])

  return (
    <button
      className="rounded-lg bg-white text-black px-4 py-2 text-sm"
      onClick={async () => {
        const res = await api.post<{ link_token: string }>('/api/plaid/link-token')
        setToken(res.link_token)
      }}
    >
      Link account
    </button>
  )
}

export default function Accounts() {
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/api/accounts'),
  })
  const { data: items = [] } = useQuery({
    queryKey: ['plaid-items'],
    queryFn: () => api.get<PlaidItem[]>('/api/plaid/items'),
  })
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/api/settings'),
  })
  const [directory, setDirectory] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState('')

  const addFiles = (incoming: FileList | File[]) => {
    const csvs = Array.from(incoming).filter((file) => file.name.toLowerCase().endsWith('.csv'))
    setFiles((prev) => {
      const seen = new Set(prev.map((file) => `${file.name}:${file.size}:${file.lastModified}`))
      const next = [...prev]
      for (const file of csvs) {
        const key = `${file.name}:${file.size}:${file.lastModified}`
        if (seen.has(key)) continue
        seen.add(key)
        next.push(file)
      }
      return next
    })
  }

  const importDir = useMutation({
    mutationFn: () => api.post<ImportResult>('/api/imports/directory', { directory: directory || undefined }),
    onSuccess: (data) => {
      setResult(formatImportResult(data))
      qc.invalidateQueries()
    },
    onError: (e: Error) => setResult(e.message),
  })
  const uploadFiles = useMutation({
    mutationFn: () => api.upload<ImportResult>('/api/imports/upload', files),
    onSuccess: (data) => {
      setResult(formatImportResult(data))
      setFiles([])
      if (fileInput.current) fileInput.current.value = ''
      qc.invalidateQueries()
    },
    onError: (e: Error) => setResult(e.message),
  })
  const sync = useMutation({
    mutationFn: () => api.post('/api/plaid/sync'),
    onSuccess: () => qc.invalidateQueries(),
  })

  useEffect(() => {
    if (settings?.csv_import_directory && !directory) setDirectory(settings.csv_import_directory)
  }, [settings, directory])

  return (
    <div>
      <header className="mb-8">
        <div className="text-[var(--muted)] text-sm mb-1">Sources</div>
        <h1 className="text-3xl tracking-tight">Accounts</h1>
      </header>

      <section className="mb-10 flex gap-3 items-center">
        {settings?.plaid_configured ? (
          <PlaidConnect />
        ) : (
          <p className="text-sm text-[var(--muted)]">Add PLAID_CLIENT_ID and PLAID_SECRET to .env to link live accounts.</p>
        )}
        <button className="text-sm text-[var(--muted)]" onClick={() => sync.mutate()} disabled={!settings?.plaid_configured}>
          {sync.isPending ? 'Syncing…' : 'Sync Plaid'}
        </button>
        {settings?.plaid_configured && (
          <span className="text-xs text-[var(--muted)]">{settings.plaid_env} · {settings.plaid_products.join(', ')}</span>
        )}
      </section>

      {items.length > 0 && (
        <div className="mb-10 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between border border-[var(--border)] rounded-xl px-4 py-3 text-sm">
              <div>{item.institution_name || item.item_id}</div>
              <div className="text-[var(--muted)]">{item.last_synced_at ? new Date(item.last_synced_at).toLocaleString() : 'Never synced'}</div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-3">Connected</h2>
      <div className="space-y-2 mb-12">
        {accounts.map((a) => (
          <div key={a.id} className="flex justify-between border border-[var(--border)] rounded-xl px-4 py-3">
            <div>
              <div>{a.name}</div>
              <div className="text-xs text-[var(--muted)]">{a.institution} · {a.kind}{a.last4 ? ` · ${a.last4}` : ''}</div>
            </div>
          </div>
        ))}
        {accounts.length === 0 && <p className="text-[var(--muted)]">No accounts yet. Import CSVs or link Plaid.</p>}
      </div>

      <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-3">Upload CSVs</h2>
      <div
        className={`mb-4 rounded-xl border border-dashed px-4 py-8 text-center ${
          dragOver ? 'border-white bg-[var(--surface-2)]' : 'border-[var(--border)]'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          addFiles(e.dataTransfer.files)
        }}
      >
        <p className="text-sm text-[var(--muted)] mb-3">Drop Chase, Amex, or utilities CSVs here, or choose files.</p>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
          }}
        />
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          onClick={() => fileInput.current?.click()}
        >
          Choose files
        </button>
      </div>
      {files.length > 0 && (
        <ul className="mb-4 space-y-2">
          {files.map((file) => (
            <li
              key={`${file.name}:${file.size}:${file.lastModified}`}
              className="flex justify-between items-center border border-[var(--border)] rounded-xl px-4 py-2 text-sm"
            >
              <span>{file.name}</span>
              <button
                type="button"
                className="text-[var(--muted)]"
                onClick={() => setFiles((prev) => prev.filter((item) => item !== file))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        className="rounded-lg bg-white text-black px-4 py-2 text-sm disabled:opacity-40"
        disabled={!files.length || uploadFiles.isPending}
        onClick={() => uploadFiles.mutate()}
      >
        {uploadFiles.isPending ? 'Processing…' : 'Upload & process'}
      </button>

      <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-3 mt-12">Import from a folder</h2>
      <div className="flex gap-3">
        <input
          className="flex-1"
          placeholder="E:\\finance\\expense_tracking"
          value={directory}
          onChange={(e) => setDirectory(e.target.value)}
        />
        <button className="rounded-lg bg-white text-black px-4 text-sm" onClick={() => importDir.mutate()}>
          Import
        </button>
      </div>
      {result && <p className="text-sm text-[var(--muted)] mt-3">{result}</p>}
    </div>
  )
}
