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
  props: { to: { type: [String, Object], required: true } },
  render() {
    const href = typeof this.to === 'string' ? this.to : this.to?.path || '#'
    const children = this.$slots.default ? this.$slots.default() : href
    return h('a', { href }, children)
  },
}

export const RouterView = {
  name: 'RouterView',
  render() {
    return this.$slots.default ? this.$slots.default() : null
  },
}
