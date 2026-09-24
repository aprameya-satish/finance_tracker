import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Account } from '../api'

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

export default function Accounts() {
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/api/accounts'),
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

  return (
    <div>
      <header className="mb-8">
        <div className="text-[var(--muted)] text-sm mb-1">On this phone</div>
        <h1 className="text-3xl tracking-tight">Accounts</h1>
      </header>
      <p className="text-sm text-[var(--muted)] mb-8 leading-relaxed">
        Everything is stored on this device. Upload Chase, Amex, or utilities CSVs from the Files app. Live bank linking
        is not available without a computer.
      </p>

      <h2 className="text-sm uppercase tracking-widest text-[var(--muted)] mb-3">Connected</h2>
      <div className="space-y-2 mb-12">
        {accounts.map((a) => (
          <div key={a.id} className="flex justify-between border border-[var(--border)] rounded-xl px-4 py-3">
            <div>
              <div>{a.name}</div>
              <div className="text-xs text-[var(--muted)]">
                {a.institution} · {a.kind}
                {a.last4 ? ` · ${a.last4}` : ''}
              </div>
            </div>
          </div>
        ))}
        {accounts.length === 0 && <p className="text-[var(--muted)]">No accounts yet. Upload a statement CSV.</p>}
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
        Review queue and household names live in{' '}
        <Link className="underline" to="/settings">
          Settings
        </Link>
        .
      </p>
    </div>
  )
}
