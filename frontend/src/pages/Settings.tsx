import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api, type Category, type Settings } from '../api'
import { financeStore } from '../local'

export default function SettingsPage() {
  const qc = useQueryClient()
  const backupInput = useRef<HTMLInputElement>(null)
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/api/settings'),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/categories'),
  })
  const [personA, setPersonA] = useState('Aprameya')
  const [personS, setPersonS] = useState('Savanthi')
  const [plaidUrl, setPlaidUrl] = useState('')
  const [plaidKey, setPlaidKey] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!data) return
    setPersonA(data.person_a)
    setPersonS(data.person_s)
    setPlaidUrl(data.plaid_api_url || '')
    setPlaidKey(data.plaid_api_key || '')
  }, [data])
  const save = useMutation({
    mutationFn: () =>
      api.put('/api/settings', {
        person_a: personA,
        person_s: personS,
        plaid_api_url: plaidUrl,
        plaid_api_key: plaidKey,
      }),
    onSuccess: () => {
      setMessage('Saved.')
      qc.invalidateQueries()
    },
    onError: (err: Error) => setMessage(err.message),
  })
  const ping = useMutation({
    mutationFn: async () => {
      await api.put('/api/settings', { plaid_api_url: plaidUrl, plaid_api_key: plaidKey })
      return api.get<Settings>('/api/settings')
    },
    onSuccess: (next) => {
      qc.invalidateQueries()
      if (next.plaid_env === 'unreachable') setMessage('Saved, but the hosted API did not respond.')
      else if (!next.plaid_configured) setMessage(`Reached ${next.plaid_env}, but Plaid keys are not set on the server.`)
      else setMessage(`Plaid ready (${next.plaid_env}). Link a bank from Accounts.`)
    },
    onError: (err: Error) => setMessage(err.message),
  })
  const toggleBudget = useMutation({
    mutationFn: (c: Category) => api.patch(`/api/categories/${c.id}`, { include_in_budget: !c.include_in_budget }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  return (
    <div>
      <header className="mb-8">
        <div className="text-[var(--muted)] text-sm mb-1">On this phone</div>
        <h1 className="text-3xl tracking-tight">Settings</h1>
      </header>
      <p className="text-sm text-[var(--muted)] mb-6 leading-relaxed">
        Data stays in this browser / home-screen app. Add it to your Home Screen from Safari share → Add to Home Screen.
      </p>
      <div className="grid gap-4 max-w-lg mb-10">
        <label className="text-sm text-[var(--muted)]">
          Person A
          <input className="block w-full mt-1" value={personA} onChange={(e) => setPersonA(e.target.value)} />
        </label>
        <label className="text-sm text-[var(--muted)]">
          Person S
          <input className="block w-full mt-1" value={personS} onChange={(e) => setPersonS(e.target.value)} />
        </label>
        <label className="text-sm text-[var(--muted)]">
          Plaid API URL
          <input
            className="block w-full mt-1"
            value={plaidUrl}
            onChange={(e) => setPlaidUrl(e.target.value)}
            placeholder="https://your-api.onrender.com"
            inputMode="url"
            autoCapitalize="none"
          />
        </label>
        <label className="text-sm text-[var(--muted)]">
          API key (optional)
          <input
            className="block w-full mt-1"
            value={plaidKey}
            onChange={(e) => setPlaidKey(e.target.value)}
            placeholder="X-Finance-Key if the host requires one"
            autoCapitalize="none"
          />
        </label>
        <p className="text-sm text-[var(--muted)]">
          Plaid secrets stay on the hosted API. This phone only stores the URL
          {data?.plaid_configured ? ` · ready (${data.plaid_env})` : data?.plaid_api_url ? ` · ${data.plaid_env}` : ''}.
        </p>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-white text-black px-4 py-2 text-sm w-fit" onClick={() => save.mutate()}>
            Save
          </button>
          <button className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm w-fit" onClick={() => ping.mutate()}>
            {ping.isPending ? 'Checking…' : 'Test Plaid API'}
          </button>
        </div>
      </div>
      <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-3">Backup</h2>
      <div className="flex flex-wrap gap-3 mb-3">
        <button
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          onClick={() => {
            const blob = new Blob([financeStore.exportJson()], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'finance-backup.json'
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          Export backup
        </button>
        <button className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm" onClick={() => backupInput.current?.click()}>
          Restore backup
        </button>
        <input
          ref={backupInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              await financeStore.importJson(await file.text())
              qc.invalidateQueries()
              setMessage('Backup restored.')
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Restore failed')
            }
          }}
        />
      </div>
      {message && <p className="text-sm text-[var(--muted)] mb-8">{message}</p>}
      <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-3">Categories</h2>
      <div className="space-y-2 max-w-lg">
        {categories.map((c) => (
          <div key={c.id} className="flex justify-between text-sm border-b border-[var(--border)] py-2">
            <span>{c.name}</span>
            <button className="text-[var(--muted)]" onClick={() => toggleBudget.mutate(c)}>
              {c.include_in_budget ? 'In budget' : 'Excluded'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
