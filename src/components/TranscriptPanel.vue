<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { formatTimestamp } from '../lib/text.js'
import Highlighter from './Highlighter.vue'

const emit = defineEmits(['select', 'back'])

const props = defineProps({
  quotes: { type: Array, default: () => [] },
  activeQuoteId: { type: String, default: '' },
  query: { type: String, default: '' },
  backLabel: { type: String, default: '' },
})
const container = ref(null)

const scrollToActive = async () => {
  await nextTick()
  if (!container.value) return
  if (!props.activeQuoteId) return
  const target = container.value.querySelector(`[data-quote-id="${props.activeQuoteId}"]`)
  if (!target) return

  const containerEl = container.value
  if (containerEl.scrollHeight <= containerEl.clientHeight) return

  const desiredTop = target.offsetTop - containerEl.clientHeight * 0.3
  const maxScroll = containerEl.scrollHeight - containerEl.clientHeight
  const nextTop = Math.min(Math.max(0, desiredTop), maxScroll)
  containerEl.scrollTo({ top: nextTop, behavior: 'smooth' })
}

onMounted(scrollToActive)
watch(() => [props.activeQuoteId, props.quotes.length], scrollToActive)
</script>

<template>
  <section class="transcript-panel">
    <header>
      <div class="panel-title">
        <button
          v-if="backLabel"
          type="button"
          class="back-button"
          @click="emit('back')"
        >
          ← {{ backLabel }}
        </button>
        <p class="panel-label">
          <span>{{ $t('transcript.title') }}</span>
          <br />
          <span>{{ $t('transcript.count', { count: quotes.length }) }}</span>
        </p>
      </div>
      <p class="panel-meta"></p>
    </header>
    <div ref="container" class="transcript-list">
      <button
        v-for="quote in quotes"
        :key="quote.id"
        class="transcript-line"
        :class="{ active: quote.id === activeQuoteId }"
        type="button"
        :data-quote-id="quote.id"
        @click="emit('select', quote)"
      >
        <span class="time">{{ formatTimestamp(quote.start) }}</span>
        <span class="text">
          <Highlighter :text="quote.text" :query="query" />
        </span>
      </button>
    </div>
  </section>
</template>
