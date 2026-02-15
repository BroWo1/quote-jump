import { reactive } from 'vue'

function parseLocation() {
  const { pathname, search, hash } = window.location
  const query = Object.fromEntries(new URLSearchParams(search))
  const segments = pathname.split('/').filter(Boolean)
  return {
    fullPath: `${pathname}${search}${hash}`,
    path: pathname,
    query,
    hash,
    segments,
  }
}

function buildUrl(path, query = {}, hash = '') {
  const searchParams = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    searchParams.set(key, String(value))
  })
  const search = searchParams.toString()
  const normalizedHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : ''
  return `${search ? `${path}?${search}` : path}${normalizedHash}`
}

const route = reactive(parseLocation())

function updateRoute() {
  Object.assign(route, parseLocation())
}

window.addEventListener('popstate', updateRoute)

export function useRoute() {
  return route
}

export function navigate(path, query, hash) {
  window.history.pushState({}, '', buildUrl(path, query, hash))
  updateRoute()
}

export function replace(path, query, hash) {
  window.history.replaceState({}, '', buildUrl(path, query, hash))
  updateRoute()
}

export function ensureSearchRoute(query) {
  replace('/search', { q: query })
}
