const OPTIONS = [
  { id: 'A', label: 'A' },
  { id: 'S', label: 'S' },
  { id: 'shared', label: 'Shared' },
]

export default function WhoControl({
  value,
  onChange,
}: {
  value: string
  onChange: (who: string) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden text-xs">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`px-2.5 py-1 ${value === opt.id ? 'bg-white text-black' : 'text-[var(--muted)] hover:text-white'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
