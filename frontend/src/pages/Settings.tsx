import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, type Category, type Settings } from '../api'

export default function SettingsPage() {
  const qc = useQueryClient()
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
  const [directory, setDirectory] = useState('')
  useEffect(() => {
    if (!data) return
    setPersonA(data.person_a)
    setPersonS(data.person_s)
    setDirectory(data.csv_import_directory)
  }, [data])
  const save = useMutation({
    mutationFn: () =>
      api.put('/api/settings', { person_a: personA, person_s: personS, csv_import_directory: directory }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
  const toggleBudget = useMutation({
    mutationFn: (c: Category) =>
      api.patch(`/api/categories/${c.id}`, { include_in_budget: !c.include_in_budget }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  return (
    <div>
      <header className="mb-8">
        <div className="text-[var(--muted)] text-sm mb-1">Household</div>
        <h1 className="text-3xl tracking-tight">Settings</h1>
      </header>
      <div className="grid gap-4 max-w-lg mb-12">
        <label className="text-sm text-[var(--muted)]">
          Person A
          <input className="block w-full mt-1" value={personA} onChange={(e) => setPersonA(e.target.value)} />
        </label>
        <label className="text-sm text-[var(--muted)]">
          Person S
          <input className="block w-full mt-1" value={personS} onChange={(e) => setPersonS(e.target.value)} />
        </label>
        <label className="text-sm text-[var(--muted)]">
          Default CSV directory
          <input className="block w-full mt-1" value={directory} onChange={(e) => setDirectory(e.target.value)} />
        </label>
        <button className="rounded-lg bg-white text-black px-4 py-2 text-sm w-fit" onClick={() => save.mutate()}>
          Save
        </button>
      </div>
      <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-3">Plaid</h2>
      <p className="text-sm text-[var(--muted)] mb-10">
        {data?.plaid_configured ? `Configured (${data.plaid_env})` : 'Not configured — keys stay in .env, never in the browser.'}
      </p>
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
