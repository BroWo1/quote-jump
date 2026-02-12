import { attachContext, extractSegments, normalizeSegments } from '../lib/quotes.js'

const state = {
  manifest: [],
  index: [],
  byBvid: new Map(),
  pending: new Set(),
  ready: false,
  buildToken: 0,
}

function tokenize(text) {
  return String(text).toLowerCase()
}

function buildIndexEntry(video, quote) {
  const entry = {
    bvid: video.bvid,
    author: video.author,
    quoteId: quote.id,
    startTime: quote.start,
    quoteText: quote.text,
    prevText: quote.prevText,
    nextText: quote.nextText,
    coverUrl: video.coverUrl,
    title: video.title,
    date: video.date,
  }
  entry.searchText = tokenize(`${quote.text} ${quote.prevText} ${quote.nextText}`)
  return entry
}

async function loadTranscript(video) {
  try {
    const response = await fetch(video.transcript)
    if (!response.ok) throw new Error(`Failed to fetch transcript for ${video.bvid}`)
    const data = await response.json()
    const segments = extractSegments(data)
    const quotes = attachContext(normalizeSegments(segments, video.bvid))
    state.byBvid.set(video.bvid, quotes)
    return quotes
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error.message,
      bvid: video.bvid,
    })
    state.byBvid.set(video.bvid, [])
    return []
  }
}

async function buildIndex(buildToken) {
  state.index = []
  state.byBvid.clear()
  const total = state.manifest.length
  let loaded = 0

  for (const video of state.manifest) {
    if (buildToken !== state.buildToken) return
    const quotes = await loadTranscript(video)
    if (buildToken !== state.buildToken) return
    for (const quote of quotes) {
      state.index.push(buildIndexEntry(video, quote))
    }
    if (state.pending.has(video.bvid)) {
      state.pending.delete(video.bvid)
      self.postMessage({
        type: 'transcript',
        bvid: video.bvid,
        quotes,
      })
    }
    loaded += 1
    self.postMessage({
      type: 'progress',
      loaded,
      total,
      bvid: video.bvid,
    })
  }

  state.ready = true
  self.postMessage({
    type: 'ready',
    totalVideos: total,
    totalQuotes: state.index.length,
  })
}

function searchIndex(query) {
  const cleanQuery = String(query ?? '').trim().toLowerCase()
  if (!cleanQuery) return []
  const tokens = cleanQuery.split(/\s+/).filter(Boolean)
  if (!tokens.length) return []

  const hits = []
  for (const entry of state.index) {
    if (tokens.every((token) => entry.searchText.includes(token))) {
      let score = 0
      for (const token of tokens) {
        const matches = entry.searchText.split(token).length - 1
        score += matches
      }
      hits.push({
        ...entry,
        score,
      })
    }
  }

  hits.sort((a, b) => b.score - a.score)
  return hits
}

self.onmessage = (event) => {
  const message = event.data
  if (!message || !message.type) return

  if (message.type === 'init') {
    state.manifest = Array.isArray(message.manifest) ? message.manifest : []
    state.ready = false
    state.pending.clear()
    state.buildToken += 1
    buildIndex(state.buildToken)
    return
  }

  if (message.type === 'search') {
    const results = searchIndex(message.query)
    self.postMessage({
      type: 'results',
      query: message.query,
      results,
    })
    return
  }

  if (message.type === 'getTranscript') {
    if (state.byBvid.has(message.bvid)) {
      const quotes = state.byBvid.get(message.bvid) || []
      self.postMessage({
        type: 'transcript',
        bvid: message.bvid,
        quotes,
      })
    } else {
      state.pending.add(message.bvid)
    }
  }
}
