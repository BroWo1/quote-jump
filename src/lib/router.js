import { reactive } from 'vue'

function parseLocation() {
  const { pathname, search } = window.location
  const query = Object.fromEntries(new URLSearchParams(search))
  const segments = pathname.split('/').filter(Boolean)
  return {
    path: pathname,
    query,
    segments,
  }
}

function buildUrl(path, query = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    searchParams.set(key, String(value))
  })
  const search = searchParams.toString()
  return search ? `${path}?${search}` : path
}

const route = reactive(parseLocation())

function updateRoute() {
  Object.assign(route, parseLocation())
}

window.addEventListener('popstate', updateRoute)

export function useRoute() {
  return route
}

export function navigate(path, query) {
  window.history.pushState({}, '', buildUrl(path, query))
  updateRoute()
}

export function replace(path, query) {
  window.history.replaceState({}, '', buildUrl(path, query))
  updateRoute()
}

export function ensureSearchRoute(query) {
  replace('/search', { q: query })
}
