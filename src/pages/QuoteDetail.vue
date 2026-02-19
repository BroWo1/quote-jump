<script setup>
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuoteStore } from '../stores/quotes.js'
import { navigate, useRoute } from '../lib/router.js'
import VideoPanel from '../components/VideoPanel.vue'
import TranscriptPanel from '../components/TranscriptPanel.vue'

const store = useQuoteStore()
const route = useRoute()
const { t } = useI18n({ useScope: 'global' })

const bvid = computed(() => route.segments[1] || '')
const query = computed(() => route.query.q || '')
const quoteId = computed(() => route.query.quote || '')

const video = computed(() => store.manifest.find((item) => item.bvid === bvid.value))
const quotes = computed(() => store.transcripts[bvid.value] || [])
const manifestReady = computed(() => store.manifest.length > 0)

const activeQuote = computed(() => {
  if (!quotes.value.length) return null
  if (quoteId.value) {
    const match = quotes.value.find((q) => q.id === quoteId.value)
    if (match) return match
  }
  const time = Number(route.query.t || 0)
  if (!Number.isNaN(time)) {
    let closest = quotes.value[0]
    let best = Math.abs(closest.start - time)
    for (const quote of quotes.value) {
      const delta = Math.abs(quote.start - time)
      if (delta < best) {
        best = delta
        closest = quote
      }
    }
    return closest
  }
  return quotes.value[0]
})

const startTime = computed(() => activeQuote.value?.start ?? Number(route.query.t || 0))

watch(
  bvid,
  (next) => {
    if (next) store.requestTranscript(next)
  },
  { immediate: true }
)

const selectQuote = (quote) => {
  if (!bvid.value) return
  navigate(`/v/${bvid.value}`, {
    quote: quote.id,
    t: Math.floor(quote.start),
    q: query.value,
  })
}

const goBack = () => {
  navigate('/search', { q: query.value || '' })
}
</script>

<template>
  <section class="quote-detail">
    <div v-if="!manifestReady" class="empty-state">
      <p>{{ t('empty.loadingManifest') }}</p>
    </div>
    <div v-else-if="!video" class="empty-state">
      <p>{{ t('empty.missingVideo') }}</p>
    </div>
    <div v-else class="detail-grid">
      <VideoPanel :video="video" :start-time="startTime" :quotes="quotes" />
      <TranscriptPanel
        :quotes="quotes"
        :active-quote-id="activeQuote?.id"
        :query="query"
        :back-label="t('actions.backToResults')"
        @select="selectQuote"
        @back="goBack"
      />
    </div>
  </section>
</template>
