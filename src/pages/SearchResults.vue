<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuoteStore } from '../stores/quotes.js'
import { useRoute } from '../lib/router.js'
import ResultsFeed from '../components/ResultsFeed.vue'
import VideoCard from '../components/VideoCard.vue'
import VideoPanel from '../components/VideoPanel.vue'
import TranscriptPanel from '../components/TranscriptPanel.vue'

const store = useQuoteStore()
const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const activeHit = ref(null)
const activeVideo = ref(null)

const query = computed(() => route.query.q || '')
const hasQuery = computed(() => query.value.trim().length > 0)

const modalOpen = computed({
  get: () => !!activeHit.value || !!activeVideo.value,
  set: (value) => {
    if (!value) {
      activeHit.value = null
      activeVideo.value = null
    }
  },
})

const modalVideo = computed(() => {
  if (activeVideo.value) return activeVideo.value
  if (!activeHit.value) return null
  return store.manifest.find((item) => item.bvid === activeHit.value.bvid) || null
})

const modalQuotes = computed(() => {
  const bvid = activeVideo.value?.bvid || activeHit.value?.bvid
  if (!bvid) return []
  return store.transcripts[bvid] || []
})

const modalActiveQuote = computed(() => {
  if (!modalQuotes.value.length) return null
  // When viewing a video directly, start at the first quote
  if (activeVideo.value && !activeHit.value) {
    return modalQuotes.value[0]
  }
  if (!activeHit.value) return null
  const targetId = activeHit.value.quoteId
  if (targetId) {
    const match = modalQuotes.value.find((quote) => quote.id === targetId)
    if (match) return match
  }
  const time = Number(activeHit.value.startTime || 0)
  if (!Number.isNaN(time)) {
    let closest = modalQuotes.value[0]
    let best = Math.abs(closest.start - time)
    for (const quote of modalQuotes.value) {
      const delta = Math.abs(quote.start - time)
      if (delta < best) {
        best = delta
        closest = quote
      }
    }
    return closest
  }
  return modalQuotes.value[0]
})

const modalStartTime = computed(() => modalActiveQuote.value?.start ?? activeHit.value?.startTime ?? 0)


watch(
  query,
  (next) => {
    const trimmed = next.trim()
    store.search(trimmed)
  },
  { immediate: true }
)

const statusLine = computed(() => {
  if (store.status === 'loading') {
    return t('status.indexing', {
      loaded: store.progress.loaded,
      total: store.progress.total,
    })
  }
  if (store.status === 'ready') {
    return t('status.ready', {
      quotes: store.stats.totalQuotes,
      videos: store.stats.totalVideos,
    })
  }
  if (store.status === 'error') return t('status.error')
  return t('status.preparing')
})

const selectHit = (hit) => {
  activeHit.value = hit
  store.requestTranscript(hit.bvid)
}

const selectVideo = (video) => {
  activeVideo.value = video
  store.requestTranscript(video.bvid)
}

const selectModalQuote = (quote) => {
  if (activeVideo.value) {
    // When viewing a video directly, create a hit-like object to track the selected quote
    activeHit.value = {
      bvid: activeVideo.value.bvid,
      quoteId: quote.id,
      startTime: quote.start,
      quoteText: quote.text,
      prevText: quote.prevText,
      nextText: quote.nextText,
    }
    return
  }
  if (!activeHit.value) return
  activeHit.value = {
    ...activeHit.value,
    quoteId: quote.id,
    startTime: quote.start,
    quoteText: quote.text,
    prevText: quote.prevText,
    nextText: quote.nextText,
  }
}
</script>

<template>
  <section class="search-results">
    <div class="status-row">
      <div class="status-pill">{{ statusLine }}</div>
      <div class="status-pill" v-if="store.query">{{ t('status.hits', { count: store.results.length }) }}</div>
    </div>

    <!-- Video grid when no search query -->
    <div v-if="!hasQuery" class="videos-grid">
      <VideoCard
        v-for="video in store.manifest"
        :key="video.bvid"
        :video="video"
        @select="selectVideo"
      />
    </div>

    <!-- Search results when there's a query -->
    <ResultsFeed v-else :results="store.results" :query="query" @select="selectHit" />

    <UModal v-model:open="modalOpen" :content="{ class: 'modal-content' }">
      <template #content="{ close }">
        <div class="modal-detail">
          <button class="modal-close" type="button" :aria-label="t('actions.closeModal')" @click="close">
            ×
          </button>
          <div v-if="!modalVideo" class="empty-state">
            <p>{{ t('empty.missingVideo') }}</p>
          </div>
          <div v-else class="detail-grid">
            <VideoPanel :video="modalVideo" :start-time="modalStartTime" />
            <TranscriptPanel
              :quotes="modalQuotes"
              :active-quote-id="modalActiveQuote?.id"
              :query="query"
              @select="selectModalQuote"
            />
          </div>
        </div>
      </template>
    </UModal>
  </section>
</template>
