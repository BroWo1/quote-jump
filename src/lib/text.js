export function formatTimestamp(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const base = `${mins}:${secs.toString().padStart(2, '0')}`
  if (hrs > 0) return `${hrs}:${base.padStart(5, '0')}`
  return base
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function splitForHighlight(text, query) {
  const safeText = String(text ?? '')
  const cleanQuery = String(query ?? '').trim()
  if (!cleanQuery) return [{ text: safeText, match: false }]
  const terms = cleanQuery.split(/\s+/).filter(Boolean)
  if (!terms.length) return [{ text: safeText, match: false }]

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
  const parts = safeText.split(pattern)

  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      match: terms.some((term) => part.toLowerCase() === term.toLowerCase()),
    }))
}
