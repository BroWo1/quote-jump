<script setup>
import { computed, ref, watch } from 'vue'
import QuoteCard from './QuoteCard.vue'

const props = defineProps({
  results: { type: Array, default: () => [] },
  query: { type: String, default: '' },
})

const emit = defineEmits(['select'])

const visibleCount = ref(12)

watch(
  () => props.results,
  () => {
    visibleCount.value = 12
  }
)

const visibleResults = computed(() => props.results.slice(0, visibleCount.value))
const hasMore = computed(() => props.results.length > visibleCount.value)

const loadMore = () => {
  visibleCount.value += 12
}
</script>

<template>
  <section class="results-feed">
    <div v-if="query && !results.length" class="empty-state">
      <p>{{ $t('empty.noResults') }}</p>
    </div>

    <div class="results-grid">
      <QuoteCard
        v-for="hit in visibleResults"
        :key="hit.quoteId"
        :hit="hit"
        :query="query"
        @select="emit('select', $event)"
      />
    </div>

    <button v-if="hasMore" class="ghost-button" type="button" @click="loadMore">
      {{ $t('actions.loadMore') }}
    </button>
  </section>
</template>
