import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Link } from 'react-router-dom'
import { api, type Account, type PlaidItem, type Settings } from '../api'

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

function redirectUri() {
  return `${window.location.origin}${window.location.pathname}`
}

function isOAuthReturn() {
  return window.location.search.includes('oauth_state_id')
}

function PlaidConnect({ enabled, onDone, onError }: { enabled: boolean; onDone: () => void; onError: (msg: string) => void }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('plaid_link_token'))
  const creating = useRef(false)

  const onSuccess = useCallback(
    async (publicToken: string) => {
      sessionStorage.removeItem('plaid_link_token')
      try {
        await api.post('/api/plaid/exchange', { public_token: publicToken })
        await api.post('/api/plaid/sync')
        if (isOAuthReturn()) window.history.replaceState({}, '', window.location.pathname)
        onDone()
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Plaid exchange failed')
      }
    },
    [onDone, onError],
  )

  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
    onExit: () => {
      sessionStorage.removeItem('plaid_link_token')
      if (isOAuthReturn()) window.history.replaceState({}, '', window.location.pathname)
    },
    receivedRedirectUri: isOAuthReturn() ? window.location.href : undefined,
  })

  useEffect(() => {
    if (token && ready) open()
  }, [token, ready, open])

  const start = async () => {
    if (creating.current) return
    creating.current = true
    try {
      const res = await api.post<{ link_token: string }>('/api/plaid/link-token', { redirect_uri: redirectUri() })
      sessionStorage.setItem('plaid_link_token', res.link_token)
      setToken(res.link_token)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not start Plaid Link')
    } finally {
      creating.current = false
    }
  }

  return (
    <button
      type="button"
      className="rounded-lg bg-white text-black px-4 py-2 text-sm disabled:opacity-40"
      disabled={!enabled}
      onClick={() => void start()}
    >
      Link bank
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
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/api/settings'),
  })
  const { data: items = [] } = useQuery({
    queryKey: ['plaid-items'],
    queryFn: () => api.get<PlaidItem[]>('/api/plaid/items'),
    enabled: Boolean(settings?.plaid_api_url),
  })
  const [files, setFiles] = useState<File[]>([])
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

  const syncPlaid = useMutation({
    mutationFn: () => api.post('/api/plaid/sync'),
    onSuccess: () => {
      setResult('Plaid sync finished. Transactions are on this device.')
      qc.invalidateQueries()
    },
    onError: (e: Error) => setResult(e.message),
  })

  const plaidReady = Boolean(settings?.plaid_api_url && settings.plaid_configured)
  const plaidUnreachable = settings?.plaid_env === 'unreachable'

  return (
    <div>
      <header className="mb-8">
        <div className="text-[var(--muted)] text-sm mb-1">On this phone</div>
        <h1 className="text-3xl tracking-tight">Accounts</h1>
      </header>
      <p className="text-sm text-[var(--muted)] mb-8 leading-relaxed">
        CSV uploads stay on this device. Live bank linking uses Plaid through a hosted API URL you set in Settings.
        After Link or Sync, statements merge here. Your Who and category labels are never overwritten.
      </p>

      <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-3">Plaid</h2>
      <div className="mb-8 space-y-3">
        {!settings?.plaid_api_url && (
          <p className="text-sm text-[var(--muted)]">
            Set a hosted Plaid API URL in{' '}
            <Link className="underline" to="/settings">
              Settings
            </Link>{' '}
            to link Chase or Amex.
          </p>
        )}
        {settings?.plaid_api_url && plaidUnreachable && (
          <p className="text-sm text-[var(--muted)]">Hosted API is unreachable. Check the URL and API key in Settings.</p>
        )}
        {settings?.plaid_api_url && !plaidUnreachable && !settings.plaid_configured && (
          <p className="text-sm text-[var(--muted)]">
            Host reached, but Plaid keys are missing on the server. Add PLAID_CLIENT_ID and PLAID_SECRET there.
          </p>
        )}
        {plaidReady && (
          <div className="flex flex-wrap gap-3">
            <PlaidConnect
              enabled
              onDone={() => {
                setResult('Bank linked. Transactions synced to this device.')
                qc.invalidateQueries()
              }}
              onError={setResult}
            />
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40"
              disabled={syncPlaid.isPending}
              onClick={() => syncPlaid.mutate()}
            >
              {syncPlaid.isPending ? 'Syncing…' : 'Sync accounts'}
            </button>
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="border border-[var(--border)] rounded-xl px-4 py-3 text-sm">
            <div>{item.institution_name || item.item_id}</div>
            <div className="text-xs text-[var(--muted)]">
              {item.status}
              {item.last_synced_at ? ` · last sync ${item.last_synced_at.replace('T', ' ').slice(0, 16)}` : ''}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-3">Connected</h2>
      <div className="space-y-2 mb-12">
        {accounts.map((a) => (
          <div key={a.id} className="flex justify-between border border-[var(--border)] rounded-xl px-4 py-3">
            <div>
              <div>{a.name}</div>
              <div className="text-xs text-[var(--muted)]">
                {a.institution} · {a.kind}
                {a.last4 ? ` · ${a.last4}` : ''}
                {a.plaid_account_id ? ' · Plaid' : ''}
              </div>
            </div>
          </div>
        ))}
        {accounts.length === 0 && <p className="text-[var(--muted)]">No accounts yet. Link a bank or upload a statement CSV.</p>}
      </div>

      <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-3">Upload CSVs</h2>
      <div className="mb-4 rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
        <p className="text-sm text-[var(--muted)] mb-3">Choose Chase, Amex, or utilities CSVs.</p>
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
              <button type="button" className="text-[var(--muted)]" onClick={() => setFiles((prev) => prev.filter((item) => item !== file))}>
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
      {result && <p className="text-sm text-[var(--muted)] mt-3">{result}</p>}
      <p className="text-sm text-[var(--muted)] mt-10">
        Household names and the Plaid API URL live in{' '}
        <Link className="underline" to="/settings">
          Settings
        </Link>
        .
      </p>
    </div>
  )
}
