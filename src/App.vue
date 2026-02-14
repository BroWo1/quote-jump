<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuoteStore } from './stores/quotes.js'
import { ensureSearchRoute, navigate, useRoute } from './lib/router.js'
import SearchBar from './components/SearchBar.vue'
import SearchResults from './pages/SearchResults.vue'
import QuoteDetail from './pages/QuoteDetail.vue'
import { LOCALE_STORAGE_KEY } from './i18n.js'

const store = useQuoteStore()
const route = useRoute()
const draftQuery = ref('')
const headerRef = ref(null)
const showCollapsedHeadbar = ref(false)
const { locale, t } = useI18n({ useScope: 'global' })
const COLLAPSED_HEADBAR_EXTRA_OFFSET = 140
const DEFAULT_STREAMER_NAME = '牢A'

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
]

const isDetail = computed(() => route.path.startsWith('/v/'))
const streamerOptions = computed(() =>
  store.availableAuthors.map((author) => ({
    value: author,
    label: author,
  }))
)
const selectedStreamer = computed({
  get: () => store.selectedAuthor,
  set: (value) => store.setSelectedAuthor(value),
})
const appTitle = computed(() => `${store.selectedAuthor || DEFAULT_STREAMER_NAME} ${t('app.name')}`)
const displayAuthor = computed(() => store.selectedAuthor || DEFAULT_STREAMER_NAME)

watch(
  () => route.query.q,
  (value) => {
    draftQuery.value = value || ''
  },
  { immediate: true }
)

watch(
  locale,
  (value) => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = value
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, value)
    }
  },
  { immediate: true }
)

watch(
  appTitle,
  (value) => {
    if (typeof document !== 'undefined') {
      document.title = value
    }
  },
  { immediate: true }
)

const submitSearch = (value) => {
  if (!value) return
  navigate('/search', { q: value })
}

const goHome = () => {
  draftQuery.value = ''
  navigate('/search', { q: '' })
}

const handleScroll = () => {
  if (!headerRef.value) {
    showCollapsedHeadbar.value = window.scrollY > 0
    return
  }

  const headerBottom = headerRef.value.offsetTop + headerRef.value.offsetHeight
  showCollapsedHeadbar.value = window.scrollY > headerBottom + COLLAPSED_HEADBAR_EXTRA_OFFSET
}

onMounted(() => {
  store.init()
  if (route.path === '/') {
    ensureSearchRoute(route.query.q || '')
  }
  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleScroll)
})
</script>

<template>
  <div class="app-shell">
    <header ref="headerRef" class="app-header">
      <div class="header-controls">
        <div class="control-group">
          <span class="control-label">{{ $t('controls.language') }}</span>
          <USelectMenu
            v-model="locale"
            :items="languageOptions"
            value-key="value"
            size="md"
            class="language-select"
            :ui="{ content: 'z-50' }"
          />
        </div>
        <div class="control-group">
          <span class="control-label">{{ $t('controls.streamer') }}</span>
          <USelectMenu
            v-model="selectedStreamer"
            :items="streamerOptions"
            value-key="value"
            size="md"
            class="streamer-select"
            :ui="{ content: 'z-50' }"
          />
        </div>
      </div>
      <div class="brand">
        <h1 class="brand-title" @click="goHome"><span class="title-author">{{ displayAuthor }}</span> {{ $t('app.name') }}</h1>
        <p class="subtitle">{{ $t('app.tagline') }}</p>
      </div>
    </header>

    <div class="search-main">
      <SearchBar
        :model-value="draftQuery"
        @update:model-value="draftQuery = $event"
        @submit="submitSearch"
      />
    </div>

    <Transition name="headbar-slide">
      <div v-if="showCollapsedHeadbar" class="search-collapsed">
        <div class="search-collapsed-inner">
          <button type="button" class="collapsed-logo-button" :aria-label="appTitle" @click="goHome">
            <img class="collapsed-logo" src="/quoteTrans.png" :alt="appTitle" />
          </button>
          <SearchBar
            :model-value="draftQuery"
            @update:model-value="draftQuery = $event"
            @submit="submitSearch"
          />
        </div>
      </div>
    </Transition>

    <main class="app-main">
      <SearchResults v-if="!isDetail" />
      <QuoteDetail v-else />
    </main>

    <footer class="app-footer">
      <span v-if="store.errors.length">{{ store.errors[store.errors.length - 1] }}</span>
    </footer>
  </div>
</template>
