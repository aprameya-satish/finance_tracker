export default function MonthPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (month: string) => void
}) {
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="tabular"
    />
  )
}
