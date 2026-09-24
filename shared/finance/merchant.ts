const PREFIXES = [
  /^APLPAY\s+/,
  /^APL PAY\s+/,
  /^APPLE PAY\s+/,
  /^SQ\s*\*?\s*/,
  /^TST\s*\*\s*/,
  /^SP\s+/,
  /^PAYPAL\s*\*/,
]

export function normalizeMerchant(raw: string | null | undefined): string {
  if (!raw) return ''
  let s = String(raw).toUpperCase().trim()
  for (const pat of PREFIXES) s = s.replace(pat, '')
  s = s.replace(/\s+[A-Z][A-Z]+\s+[A-Z]{2}$/, '')
  s = s.replace(/\s+[A-Z]{2}$/, '')
  s = s.replace(/\s+\d{5}(?:-\d{4})?$/, '')
  s = s.replace(/\s+#?\d{3,}$/, '')
  s = s.replace(/[^A-Z0-9 &]+/g, ' ').replace(/\s+/g, ' ').trim()
  return s
}

export function parseWho(value: unknown): string {
  if (value == null) return 'shared'
  const text = String(value).trim().toUpperCase()
  return text === 'A' || text === 'S' ? text : 'shared'
}

export async function csvFingerprint(
  last4: string | null,
  txnDate: string,
  amountCents: number,
  description: string,
): Promise<string> {
  const key = `${last4 || ''}|${txnDate}|${amountCents}|${normalizeMerchant(description)}`
  const data = new TextEncoder().encode(key)
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32)
  }
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) hash = (hash ^ key.charCodeAt(i)) * 16777619
  return `fnv${(hash >>> 0).toString(16).padStart(8, '0')}${key.length.toString(16)}`.slice(0, 32)
}
