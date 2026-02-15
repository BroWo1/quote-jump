import { h } from 'vue'
import { useRoute as useAppRoute, navigate, replace } from './router.js'

export function useRoute() {
  return useAppRoute()
}

export function useRouter() {
  return {
    push: (to) => {
      if (typeof to === 'string') {
        navigate(to)
        return Promise.resolve()
      }
      navigate(to?.path || '/', to?.query || {})
      return Promise.resolve()
    },
    replace: (to) => {
      if (typeof to === 'string') {
        replace(to)
        return Promise.resolve()
      }
      replace(to?.path || '/', to?.query || {})
      return Promise.resolve()
    },
    back: () => window.history.back(),
    resolve: (to) => ({ href: typeof to === 'string' ? to : to?.path || '/' }),
  }
}

export function createRouter() {
  return { install: () => {} }
}

export function createWebHistory() {
  return {}
}

export function createWebHashHistory() {
  return {}
}

export function createMemoryHistory() {
  return {}
}

export function onBeforeRouteLeave() {}

export function onBeforeRouteUpdate() {}

export const RouterLink = {
  name: 'RouterLink',
  props: {
    to: { type: [String, Object], required: true },
    custom: { type: Boolean, default: false },
    replace: { type: Boolean, default: false },
  },
  methods: {
    resolveToRoute(to) {
      const current = useAppRoute()

      if (typeof to === 'string') {
        const url = new URL(to, window.location.origin)
        return {
          fullPath: `${url.pathname}${url.search}${url.hash}`,
          path: url.pathname,
          query: Object.fromEntries(url.searchParams),
          hash: url.hash,
        }
      }

      const path = to?.path || current.path || '/'
      const query = to?.query || {}
      const hash = to?.hash || ''
      const searchParams = new URLSearchParams()
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return
        searchParams.set(key, String(value))
      })
      const search = searchParams.toString()
      const normalizedHash = hash ? (String(hash).startsWith('#') ? String(hash) : `#${hash}`) : ''

      return {
        fullPath: `${path}${search ? `?${search}` : ''}${normalizedHash}`,
        path,
        query,
        hash: normalizedHash,
      }
    },
    isRouteActive(currentPath, targetPath) {
      if (currentPath === targetPath) return true
      if (!targetPath || targetPath === '/') return currentPath === '/'
      return currentPath.startsWith(`${targetPath}/`)
    },
  },
  render() {
    const current = useAppRoute()
    const targetRoute = this.resolveToRoute(this.to)
    const href = targetRoute.fullPath || targetRoute.path || '#'
    const isExactActive = current.path === targetRoute.path
    const isActive = this.isRouteActive(current.path, targetRoute.path)
    const navigateFn = (event) => {
      if (event?.defaultPrevented) return
      if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) {
        return
      }
      event?.preventDefault?.()

      if (this.replace) {
        replace(targetRoute.path, targetRoute.query, targetRoute.hash)
        return
      }
      navigate(targetRoute.path, targetRoute.query, targetRoute.hash)
    }

    const slotProps = {
      href,
      navigate: navigateFn,
      route: targetRoute,
      isActive,
      isExactActive,
    }

    if (this.custom) {
      return this.$slots.default ? this.$slots.default(slotProps) : null
    }

    const children = this.$slots.default ? this.$slots.default(slotProps) : href
    return h('a', { href, onClick: navigateFn }, children)
  },
}

export const RouterView = {
  name: 'RouterView',
  render() {
    return this.$slots.default ? this.$slots.default() : null
  },
}
