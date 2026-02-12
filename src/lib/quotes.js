export function cleanText(text = '') {
  return String(text).replace(/\s+/g, ' ').trim()
}

export function hashString(input) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(36)
}

export function createQuoteId(bvid, startTime, text) {
  const key = `${bvid}|${Math.round(startTime * 1000)}|${cleanText(text)}`
  return `q_${hashString(key)}`
}

const sentenceEndRe = /[.!?…]["'”)]?$/

export function normalizeSegments(segments, bvid) {
  const hasSegmentIds = segments.some((segment) => segment && segment.id !== undefined)
  if (hasSegmentIds) {
    return segments
      .map((segment) => {
        const text = cleanText(segment.text || segment.texts || '')
        if (!text) return null
        const start = Number(segment.start ?? 0)
        const end = Number(segment.end ?? segment.start ?? 0)
        return {
          id: createQuoteId(bvid, start, text),
          start,
          end,
          text,
        }
      })
      .filter(Boolean)
  }

  const quotes = []
  let buffer = ''
  let bufferStart = null
  let bufferEnd = null

  const emit = () => {
    const text = cleanText(buffer)
    if (!text) {
      buffer = ''
      bufferStart = null
      bufferEnd = null
      return
    }
    const quote = {
      id: createQuoteId(bvid, bufferStart || 0, text),
      start: bufferStart || 0,
      end: bufferEnd || bufferStart || 0,
      text,
    }
    quotes.push(quote)
    buffer = ''
    bufferStart = null
    bufferEnd = null
  }

  for (const segment of segments) {
    const text = cleanText(segment.text || segment.texts || '')
    if (!text) continue

    if (!buffer) {
      bufferStart = Number(segment.start ?? 0)
    }
    bufferEnd = Number(segment.end ?? segment.start ?? bufferEnd ?? bufferStart ?? 0)
    buffer = buffer ? `${buffer} ${text}` : text

    if (sentenceEndRe.test(text) || buffer.length > 220) {
      emit()
    }
  }

  if (buffer) emit()
  return quotes
}

export function attachContext(quotes) {
  return quotes.map((quote, index) => ({
    ...quote,
    prevText: index > 0 ? quotes[index - 1].text : '',
    nextText: index < quotes.length - 1 ? quotes[index + 1].text : '',
  }))
}

export function extractSegments(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.segments)) return data.segments
  if (Array.isArray(data.result?.segments)) return data.result.segments
  if (Array.isArray(data.data?.segments)) return data.data.segments
  return []
}
