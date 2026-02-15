import { attachContext, extractSegments, normalizeSegments } from '../lib/quotes.js'

const K1 = 1.4
const B = 0.75
const EMBEDDING_DIM = 128
const SEMANTIC_MIN_SCORE = 0.12
const RERANK_TOP_K = 120
const INDEX_CACHE_DB = 'quote-jump-cache'
const INDEX_CACHE_STORE = 'search-index'
const INDEX_CACHE_DB_VERSION = 1
const INDEX_SCHEMA_VERSION = 1

const FIELD_WEIGHTS = {
  quote: 3.6,
  title: 2.1,
  context: 1.0,
}

const state = {
  manifest: [],
  index: [],
  byBvid: new Map(),
  pending: new Set(),
  ready: false,
  buildToken: 0,
  cacheKey: '',
  rankModel: {
    idf: new Map(),
    avgFieldLength: {
      quote: 1,
      title: 1,
      context: 1,
    },
    totalDocs: 0,
  },
}

function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function compactText(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9\u3400-\u4dbf\u4e00-\u9fff\uF900-\uFAFF]/g, '')
}

function isHanChar(char) {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uF900-\uFAFF]/.test(char)
}

function extractWordTokens(text) {
  const words = normalizeText(text).match(/[a-z0-9]+/g)
  return words || []
}

function extractHanRuns(text) {
  const runs = []
  let buffer = ''
  for (const char of normalizeText(text)) {
    if (isHanChar(char)) {
      buffer += char
      continue
    }
    if (buffer) {
      runs.push(buffer)
      buffer = ''
    }
  }
  if (buffer) runs.push(buffer)
  return runs
}

function createHanTokens(text) {
  const tokens = []
  const runs = extractHanRuns(text)
  for (const run of runs) {
    const chars = [...run]
    if (!chars.length) continue

    for (let i = 0; i < chars.length; i += 1) {
      tokens.push(chars[i])
    }
    for (let i = 0; i < chars.length - 1; i += 1) {
      tokens.push(chars[i] + chars[i + 1])
    }
    for (let i = 0; i < chars.length - 2; i += 1) {
      tokens.push(chars[i] + chars[i + 1] + chars[i + 2])
    }
  }
  return tokens
}

function tokenizeForSearch(text) {
  return [...extractWordTokens(text), ...createHanTokens(text)]
}

function toTermFrequency(tokens) {
  const map = new Map()
  for (const token of tokens) {
    map.set(token, (map.get(token) || 0) + 1)
  }
  return map
}

function hashString(input) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return hash >>> 0
}

function toMap(value) {
  if (value instanceof Map) return value
  if (Array.isArray(value)) return new Map(value)
  if (value && typeof value === 'object') return new Map(Object.entries(value))
  return new Map()
}

function toSet(value) {
  if (value instanceof Set) return value
  if (Array.isArray(value)) return new Set(value)
  return new Set()
}

function toFloat32Array(value) {
  if (value instanceof Float32Array) return value
  if (Array.isArray(value)) return Float32Array.from(value)
  if (ArrayBuffer.isView(value)) return new Float32Array(value)
  return new Float32Array(EMBEDDING_DIM)
}

function waitForRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
  })
}

function waitForTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'))
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'))
  })
}

function openCacheDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEX_CACHE_DB, INDEX_CACHE_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(INDEX_CACHE_STORE)) {
        db.createObjectStore(INDEX_CACHE_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Failed to open index cache'))
  })
}

async function readCachedIndex(cacheKey) {
  if (!cacheKey) return null
  let db
  try {
    db = await openCacheDb()
    if (!db) return null

    const tx = db.transaction(INDEX_CACHE_STORE, 'readonly')
    const store = tx.objectStore(INDEX_CACHE_STORE)
    const record = await waitForRequest(store.get(cacheKey))
    await waitForTransaction(tx)
    return record || null
  } catch {
    return null
  } finally {
    if (db) db.close()
  }
}

async function writeCachedIndex(cacheKey, payload) {
  if (!cacheKey || !payload) return
  let db
  try {
    db = await openCacheDb()
    if (!db) return

    const tx = db.transaction(INDEX_CACHE_STORE, 'readwrite')
    tx.objectStore(INDEX_CACHE_STORE).put(payload, cacheKey)
    await waitForTransaction(tx)
  } catch {
    // Cache write failures are non-fatal.
  } finally {
    if (db) db.close()
  }
}

function createManifestCacheKey(manifest) {
  const signature = manifest.map((video) => ({
    bvid: String(video.bvid || ''),
    author: String(video.author || ''),
    title: String(video.title || ''),
    date: String(video.date || ''),
    transcript: String(video.transcript || ''),
    coverUrl: String(video.coverUrl || ''),
  }))

  return `v${INDEX_SCHEMA_VERSION}:${manifest.length}:${hashString(JSON.stringify(signature))}`
}

function serializeIndexEntry(entry) {
  return {
    ...entry,
    _search: {
      ...entry._search,
      quoteTf: Array.from(entry._search.quoteTf.entries()),
      titleTf: Array.from(entry._search.titleTf.entries()),
      contextTf: Array.from(entry._search.contextTf.entries()),
      uniqueTokens: Array.from(entry._search.uniqueTokens.values()),
    },
  }
}

function reviveIndexEntry(entry) {
  if (!entry || !entry._search) return null

  return {
    ...entry,
    _search: {
      ...entry._search,
      quoteTf: toMap(entry._search.quoteTf),
      titleTf: toMap(entry._search.titleTf),
      contextTf: toMap(entry._search.contextTf),
      uniqueTokens: toSet(entry._search.uniqueTokens),
      semanticVector: toFloat32Array(entry._search.semanticVector),
    },
  }
}

function serializeRankModel(rankModel) {
  return {
    idf: Array.from(rankModel.idf.entries()),
    totalDocs: rankModel.totalDocs,
    avgFieldLength: rankModel.avgFieldLength,
  }
}

function reviveRankModel(rankModel) {
  return {
    idf: toMap(rankModel?.idf),
    totalDocs: Number(rankModel?.totalDocs || 0),
    avgFieldLength: {
      quote: Number(rankModel?.avgFieldLength?.quote || 1),
      title: Number(rankModel?.avgFieldLength?.title || 1),
      context: Number(rankModel?.avgFieldLength?.context || 1),
    },
  }
}

function createCachePayload(cacheKey) {
  return {
    schemaVersion: INDEX_SCHEMA_VERSION,
    savedAt: Date.now(),
    totalVideos: state.manifest.length,
    totalQuotes: state.index.length,
    index: state.index.map(serializeIndexEntry),
    byBvidEntries: Array.from(state.byBvid.entries()),
    rankModel: serializeRankModel(state.rankModel),
    cacheKey,
  }
}

async function persistCurrentIndex(cacheKey) {
  if (!cacheKey) return
  const payload = createCachePayload(cacheKey)
  await writeCachedIndex(cacheKey, payload)
}

async function restoreCachedIndex(cacheKey) {
  const cached = await readCachedIndex(cacheKey)
  if (!cached || cached.schemaVersion !== INDEX_SCHEMA_VERSION) return false
  if (!Array.isArray(cached.index)) return false

  const restoredIndex = cached.index.map(reviveIndexEntry).filter(Boolean)
  const restoredByBvid = new Map()
  if (Array.isArray(cached.byBvidEntries)) {
    for (const [bvid, quotes] of cached.byBvidEntries) {
      restoredByBvid.set(bvid, Array.isArray(quotes) ? quotes : [])
    }
  }

  state.index = restoredIndex
  state.byBvid = restoredByBvid
  state.rankModel = reviveRankModel(cached.rankModel)
  state.ready = true
  return true
}

function normalizeVector(vector) {
  let norm = 0
  for (let i = 0; i < vector.length; i += 1) {
    norm += vector[i] * vector[i]
  }
  if (!norm) return vector
  const scale = 1 / Math.sqrt(norm)
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] *= scale
  }
  return vector
}

function buildCharNgramVector(text, dimension = EMBEDDING_DIM) {
  const compact = compactText(text)
  const vector = new Float32Array(dimension)
  const chars = [...compact]
  if (!chars.length) return vector

  const ngrams = []
  for (let i = 0; i < chars.length; i += 1) {
    ngrams.push(chars[i])
    if (i < chars.length - 1) ngrams.push(chars[i] + chars[i + 1])
    if (i < chars.length - 2) ngrams.push(chars[i] + chars[i + 1] + chars[i + 2])
    if (i < chars.length - 3) ngrams.push(chars[i] + chars[i + 1] + chars[i + 2] + chars[i + 3])
  }

  for (const gram of ngrams) {
    const hash = hashString(gram)
    const index = hash % dimension
    const sign = hash & 1 ? 1 : -1
    vector[index] += sign
  }
  return normalizeVector(vector)
}

function weightedVector(parts, dimension = EMBEDDING_DIM) {
  const vector = new Float32Array(dimension)
  for (const part of parts) {
    if (!part?.text || !part.weight) continue
    const partVector = buildCharNgramVector(part.text, dimension)
    for (let i = 0; i < dimension; i += 1) {
      vector[i] += partVector[i] * part.weight
    }
  }
  return normalizeVector(vector)
}

function dotProduct(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let sum = 0
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i]
  }
  return sum
}

function bm25(tf, idf, fieldLength, averageLength) {
  if (!tf || !idf) return 0
  const safeAvgLen = averageLength > 0 ? averageLength : 1
  const norm = K1 * (1 - B + B * (fieldLength / safeAvgLen))
  return idf * ((tf * (K1 + 1)) / (tf + norm))
}

function updateDocumentFrequency(map, tokenSet) {
  for (const token of tokenSet) {
    map.set(token, (map.get(token) || 0) + 1)
  }
}

function buildIndexEntry(video, quote) {
  const quoteNormalized = normalizeText(quote.text)
  const titleNormalized = normalizeText(video.title)
  const contextText = `${quote.prevText || ''} ${quote.nextText || ''}`
  const contextNormalized = normalizeText(contextText)

  const quoteTokens = tokenizeForSearch(quoteNormalized)
  const titleTokens = tokenizeForSearch(titleNormalized)
  const contextTokens = tokenizeForSearch(contextNormalized)

  const searchableText = `${quoteNormalized} ${titleNormalized} ${contextNormalized}`.trim()

  return {
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
    searchText: searchableText,
    _search: {
      quoteNormalized,
      titleNormalized,
      contextNormalized,
      quoteCompact: compactText(quoteNormalized),
      titleCompact: compactText(titleNormalized),
      contextCompact: compactText(contextNormalized),
      quoteTf: toTermFrequency(quoteTokens),
      titleTf: toTermFrequency(titleTokens),
      contextTf: toTermFrequency(contextTokens),
      quoteLength: quoteTokens.length,
      titleLength: titleTokens.length,
      contextLength: contextTokens.length,
      uniqueTokens: new Set([...quoteTokens, ...titleTokens, ...contextTokens]),
      semanticVector: weightedVector([
        { text: quoteNormalized, weight: 1.0 },
        { text: titleNormalized, weight: 0.65 },
        { text: contextNormalized, weight: 0.35 },
      ]),
    },
  }
}

function computeRankModel(index, docFrequency, fieldLengthSums) {
  const totalDocs = index.length
  const idf = new Map()
  for (const [token, df] of docFrequency.entries()) {
    const value = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5))
    idf.set(token, value)
  }

  return {
    idf,
    totalDocs,
    avgFieldLength: {
      quote: totalDocs ? fieldLengthSums.quote / totalDocs : 1,
      title: totalDocs ? fieldLengthSums.title / totalDocs : 1,
      context: totalDocs ? fieldLengthSums.context / totalDocs : 1,
    },
  }
}

function findTokenPositions(text, tokens) {
  const positions = []
  for (const token of tokens) {
    const index = text.indexOf(token)
    if (index !== -1) positions.push(index)
  }
  return positions
}

function computeLexicalScore(entry, queryTokens) {
  const details = {
    rawScore: 0,
    matchedTokenCount: 0,
    quoteTokenMatches: 0,
    titleTokenMatches: 0,
    contextTokenMatches: 0,
    tokenCoverage: 0,
    allTokensInQuote: false,
    phraseInQuote: false,
    phraseInTitle: false,
  }

  if (!queryTokens.length) return details
  const matchedTokens = []

  for (const token of queryTokens) {
    const idf = state.rankModel.idf.get(token) || 0
    if (!idf) continue

    const quoteTf = entry._search.quoteTf.get(token) || 0
    const titleTf = entry._search.titleTf.get(token) || 0
    const contextTf = entry._search.contextTf.get(token) || 0
    const tokenMatched = quoteTf > 0 || titleTf > 0 || contextTf > 0
    if (!tokenMatched) continue
    matchedTokens.push(token)

    if (quoteTf > 0) details.quoteTokenMatches += 1
    if (titleTf > 0) details.titleTokenMatches += 1
    if (contextTf > 0) details.contextTokenMatches += 1

    details.rawScore += FIELD_WEIGHTS.quote * bm25(
      quoteTf,
      idf,
      entry._search.quoteLength,
      state.rankModel.avgFieldLength.quote
    )
    details.rawScore += FIELD_WEIGHTS.title * bm25(
      titleTf,
      idf,
      entry._search.titleLength,
      state.rankModel.avgFieldLength.title
    )
    details.rawScore += FIELD_WEIGHTS.context * bm25(
      contextTf,
      idf,
      entry._search.contextLength,
      state.rankModel.avgFieldLength.context
    )
  }

  details.matchedTokenCount = matchedTokens.length
  details.tokenCoverage = matchedTokens.length / queryTokens.length
  details.allTokensInQuote = details.quoteTokenMatches === queryTokens.length
  return details
}

function computeRerankBonus(candidate, queryMeta) {
  let bonus = 0
  const { lexical } = candidate

  if (queryMeta.compact && candidate.entry._search.quoteCompact.includes(queryMeta.compact)) {
    bonus += 0.34
    lexical.phraseInQuote = true
  }
  if (queryMeta.compact && candidate.entry._search.titleCompact.includes(queryMeta.compact)) {
    bonus += 0.16
    lexical.phraseInTitle = true
  }
  if (lexical.allTokensInQuote) bonus += 0.18
  if (lexical.tokenCoverage > 0) bonus += lexical.tokenCoverage * 0.2

  const quotePositions = findTokenPositions(candidate.entry._search.quoteNormalized, queryMeta.tokens)
  if (quotePositions.length >= 2) {
    const span = Math.max(...quotePositions) - Math.min(...quotePositions)
    const compactSpan = Math.max(1, queryMeta.compact.length || queryMeta.original.length || 1)
    bonus += Math.max(0, 0.12 - span / (compactSpan * 200))
  }

  if (!lexical.quoteTokenMatches && lexical.contextTokenMatches) {
    bonus -= 0.06
  }

  return bonus
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

async function buildIndex(buildToken, cacheKey = state.cacheKey) {
  state.index = []
  state.byBvid.clear()

  const docFrequency = new Map()
  const fieldLengthSums = {
    quote: 0,
    title: 0,
    context: 0,
  }

  const total = state.manifest.length
  let loaded = 0

  for (const video of state.manifest) {
    if (buildToken !== state.buildToken) return
    const quotes = await loadTranscript(video)
    if (buildToken !== state.buildToken) return

    for (const quote of quotes) {
      const entry = buildIndexEntry(video, quote)
      state.index.push(entry)
      updateDocumentFrequency(docFrequency, entry._search.uniqueTokens)
      fieldLengthSums.quote += entry._search.quoteLength
      fieldLengthSums.title += entry._search.titleLength
      fieldLengthSums.context += entry._search.contextLength
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

  state.rankModel = computeRankModel(state.index, docFrequency, fieldLengthSums)
  state.ready = true

  self.postMessage({
    type: 'ready',
    totalVideos: total,
    totalQuotes: state.index.length,
  })

  void persistCurrentIndex(cacheKey)
}

async function restoreOrBuildIndex(buildToken) {
  const cacheKey = createManifestCacheKey(state.manifest)
  state.cacheKey = cacheKey

  const restored = await restoreCachedIndex(cacheKey)
  if (buildToken !== state.buildToken) return

  if (restored) {
    const total = state.manifest.length
    self.postMessage({
      type: 'progress',
      loaded: total,
      total,
      cached: true,
    })
    self.postMessage({
      type: 'ready',
      totalVideos: total,
      totalQuotes: state.index.length,
      cached: true,
    })
    return
  }

  await buildIndex(buildToken, cacheKey)
}

function findVideoByBvid(bvid) {
  return state.manifest.find((video) => video.bvid === bvid) || null
}

async function loadPendingTranscript(bvid, buildToken) {
  const video = findVideoByBvid(bvid)
  if (!video) {
    state.pending.delete(bvid)
    self.postMessage({
      type: 'transcript',
      bvid,
      quotes: [],
    })
    return
  }

  const quotes = await loadTranscript(video)
  if (buildToken !== state.buildToken) return

  if (state.pending.has(bvid)) {
    state.pending.delete(bvid)
    self.postMessage({
      type: 'transcript',
      bvid,
      quotes,
    })
  }

  if (state.cacheKey) {
    void persistCurrentIndex(state.cacheKey)
  }
}

function searchIndex(query) {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  const queryTokens = Array.from(new Set(tokenizeForSearch(normalizedQuery)))
  const queryVector = buildCharNgramVector(normalizedQuery)
  const queryCompact = compactText(normalizedQuery)
  const queryMeta = {
    original: normalizedQuery,
    compact: queryCompact,
    tokens: queryTokens,
    vector: queryVector,
  }

  const candidates = []

  for (const entry of state.index) {
    const lexical = computeLexicalScore(entry, queryTokens)
    const semantic = dotProduct(queryMeta.vector, entry._search.semanticVector)

    const hasLexicalSignal = lexical.rawScore > 0 || lexical.matchedTokenCount > 0
    const hasSemanticSignal = semantic >= SEMANTIC_MIN_SCORE
    const hasCompactSignal = queryCompact
      ? entry._search.quoteCompact.includes(queryCompact) ||
        entry._search.titleCompact.includes(queryCompact) ||
        entry._search.contextCompact.includes(queryCompact)
      : false

    if (!hasLexicalSignal && !hasSemanticSignal && !hasCompactSignal) continue

    const matchClass = lexical.quoteTokenMatches
      ? 'quote'
      : lexical.titleTokenMatches
        ? 'title'
        : 'context'

    candidates.push({
      entry,
      lexical,
      semantic,
      matchClass,
      key: `${entry.bvid}:${entry.quoteId}`,
      hybridScore: 0,
      finalScore: 0,
      rerankBonus: 0,
    })
  }

  if (!candidates.length) return []

  let maxLexical = 0
  let maxSemantic = 0
  for (const candidate of candidates) {
    if (candidate.lexical.rawScore > maxLexical) maxLexical = candidate.lexical.rawScore
    if (candidate.semantic > maxSemantic) maxSemantic = candidate.semantic
  }
  maxLexical = maxLexical || 1
  maxSemantic = maxSemantic || 1

  for (const candidate of candidates) {
    const lexicalNorm = candidate.lexical.rawScore / maxLexical
    const semanticNorm = Math.max(0, candidate.semantic) / maxSemantic
    candidate.hybridScore = lexicalNorm * 0.74 + semanticNorm * 0.26
  }

  const rerankKeys = new Set(
    [...candidates]
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, RERANK_TOP_K)
      .map((candidate) => candidate.key)
  )

  for (const candidate of candidates) {
    if (rerankKeys.has(candidate.key)) {
      candidate.rerankBonus = computeRerankBonus(candidate, queryMeta)
    }
    candidate.finalScore = candidate.hybridScore + candidate.rerankBonus
  }

  const classPriority = {
    quote: 0,
    title: 1,
    context: 2,
  }

  candidates.sort((a, b) => {
    if (classPriority[a.matchClass] !== classPriority[b.matchClass]) {
      return classPriority[a.matchClass] - classPriority[b.matchClass]
    }
    if (a.finalScore !== b.finalScore) return b.finalScore - a.finalScore
    if (a.lexical.matchedTokenCount !== b.lexical.matchedTokenCount) {
      return b.lexical.matchedTokenCount - a.lexical.matchedTokenCount
    }
    return a.entry.startTime - b.entry.startTime
  })

  return candidates.map((candidate) => ({
    bvid: candidate.entry.bvid,
    author: candidate.entry.author,
    quoteId: candidate.entry.quoteId,
    startTime: candidate.entry.startTime,
    quoteText: candidate.entry.quoteText,
    prevText: candidate.entry.prevText,
    nextText: candidate.entry.nextText,
    coverUrl: candidate.entry.coverUrl,
    title: candidate.entry.title,
    date: candidate.entry.date,
    matchClass: candidate.matchClass,
    score: candidate.finalScore,
    lexicalScore: candidate.lexical.rawScore,
    semanticScore: candidate.semantic,
    rerankBonus: candidate.rerankBonus,
    tokenCoverage: candidate.lexical.tokenCoverage,
    matchedTokenCount: candidate.lexical.matchedTokenCount,
    quoteHits: candidate.lexical.quoteTokenMatches,
    contextHits: candidate.lexical.contextTokenMatches,
  }))
}

self.onmessage = (event) => {
  const message = event.data
  if (!message || !message.type) return

  if (message.type === 'init') {
    state.manifest = Array.isArray(message.manifest) ? message.manifest : []
    state.ready = false
    state.pending.clear()
    state.buildToken += 1
    restoreOrBuildIndex(state.buildToken)
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
      const alreadyPending = state.pending.has(message.bvid)
      state.pending.add(message.bvid)
      if (state.ready && !alreadyPending) {
        void loadPendingTranscript(message.bvid, state.buildToken)
      }
    }
  }
}
