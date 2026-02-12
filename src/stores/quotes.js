import { defineStore } from 'pinia'

const MANIFEST_URL = '/manifest.json'
const DEFAULT_AUTHOR = '牢A'
const STREAMER_STORAGE_KEY = 'quote-jump-streamer'

const getStoredAuthor = () => {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(STREAMER_STORAGE_KEY)
}

const setStoredAuthor = (author) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STREAMER_STORAGE_KEY, author)
}

const normalizeManifest = (input) => {
  const videos = Array.isArray(input) ? input : input?.videos || []
  return videos.map((video) => ({
    ...video,
    author: video.author || DEFAULT_AUTHOR,
  }))
}

const listAuthors = (manifest) => {
  const authors = Array.from(new Set(manifest.map((video) => video.author).filter(Boolean)))
  return authors.length ? authors : [DEFAULT_AUTHOR]
}

const createWorkerManifest = (manifest) =>
  manifest.map((video) => ({
    bvid: String(video.bvid || ''),
    author: String(video.author || DEFAULT_AUTHOR),
    title: String(video.title || ''),
    coverUrl: video.coverUrl ? String(video.coverUrl) : '',
    date: video.date ? String(video.date) : '',
    transcript: String(video.transcript || ''),
  }))

const normalizeAuthorInput = (author) => {
  if (typeof author === 'string') return author
  if (author && typeof author === 'object') {
    if (typeof author.value === 'string') return author.value
    if (typeof author.label === 'string') return author.label
  }
  return ''
}

export const useQuoteStore = defineStore('quotes', {
  state: () => ({
    allManifest: [],
    manifest: [],
    selectedAuthor: DEFAULT_AUTHOR,
    availableAuthors: [DEFAULT_AUTHOR],
    status: 'idle',
    progress: {
      loaded: 0,
      total: 0,
    },
    stats: {
      totalVideos: 0,
      totalQuotes: 0,
    },
    query: '',
    results: [],
    transcripts: {},
    errors: [],
  }),
  actions: {
    async init() {
      if (this.status !== 'idle') return
      this.status = 'loading'
      try {
        const response = await fetch(MANIFEST_URL)
        if (!response.ok) throw new Error('Failed to load manifest')
        const data = await response.json()
        this.allManifest = normalizeManifest(data)
        this.availableAuthors = listAuthors(this.allManifest)

        const storedAuthor = getStoredAuthor()
        const preferredAuthor = storedAuthor || DEFAULT_AUTHOR
        const fallbackAuthor = this.availableAuthors.includes(DEFAULT_AUTHOR)
          ? DEFAULT_AUTHOR
          : this.availableAuthors[0]
        this.selectedAuthor = this.availableAuthors.includes(preferredAuthor)
          ? preferredAuthor
          : fallbackAuthor
        setStoredAuthor(this.selectedAuthor)

        this._applyManifestFilter()
        this._bootWorker()
      } catch (error) {
        this.status = 'error'
        this.errors.push(error.message)
      }
    },
    _applyManifestFilter() {
      this.manifest = this.allManifest.filter((video) => video.author === this.selectedAuthor)
    },
    _indexManifest() {
      if (!this._worker) return

      this.status = 'loading'
      this.progress = {
        loaded: 0,
        total: this.manifest.length,
      }
      this.stats = {
        totalVideos: 0,
        totalQuotes: 0,
      }
      this.results = []
      this.transcripts = {}

      const manifest = createWorkerManifest(this.manifest)
      this._worker.postMessage({
        type: 'init',
        manifest,
      })
    },
    _bootWorker() {
      if (this._worker) return
      const worker = new Worker(new URL('../workers/indexer.worker.js', import.meta.url), {
        type: 'module',
      })
      worker.onmessage = (event) => {
        const message = event.data
        if (message.type === 'progress') {
          this.progress = {
            loaded: message.loaded,
            total: message.total,
          }
        }
        if (message.type === 'ready') {
          this.status = 'ready'
          this.stats = {
            totalVideos: message.totalVideos,
            totalQuotes: message.totalQuotes,
          }
          if (this.query) {
            worker.postMessage({
              type: 'search',
              query: this.query,
            })
          }
        }
        if (message.type === 'results') {
          if (message.query !== this.query) return
          this.results = message.results
        }
        if (message.type === 'transcript') {
          this.transcripts = {
            ...this.transcripts,
            [message.bvid]: message.quotes,
          }
        }
        if (message.type === 'error') {
          this.errors.push(message.message)
        }
      }
      worker.onerror = (error) => {
        this.errors.push(error.message)
        this.status = 'error'
      }
      this._worker = worker
      this._indexManifest()
    },
    setSelectedAuthor(author) {
      const nextAuthor = normalizeAuthorInput(author)
      if (!nextAuthor) return
      if (!this.availableAuthors.includes(nextAuthor)) return
      if (nextAuthor === this.selectedAuthor) return

      this.selectedAuthor = nextAuthor
      setStoredAuthor(nextAuthor)
      this._applyManifestFilter()

      if (!this._worker) {
        this._bootWorker()
        return
      }
      this._indexManifest()
    },
    search(query) {
      this.query = query
      if (!this._worker) return
      this._worker.postMessage({
        type: 'search',
        query,
      })
    },
    requestTranscript(bvid) {
      if (!this._worker) return
      if (this.transcripts[bvid]) return
      this._worker.postMessage({
        type: 'getTranscript',
        bvid,
      })
    },
  },
})
