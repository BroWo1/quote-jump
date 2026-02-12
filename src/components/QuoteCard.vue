<script setup>
import { computed, ref, onMounted } from 'vue'
import { formatTimestamp } from '../lib/text.js'
import { fetchVideoInfo } from '../lib/bilibili.js'
import Highlighter from './Highlighter.vue'

const props = defineProps({
  hit: { type: Object, required: true },
  query: { type: String, default: '' },
})

const emit = defineEmits(['select'])

const bilibiliInfo = ref(null)

const timestamp = computed(() => formatTimestamp(props.hit.startTime))

const coverUrl = computed(() => {
  if (bilibiliInfo.value?.coverUrl) {
    return bilibiliInfo.value.coverUrl
  }
  return props.hit.coverUrl || null
})

onMounted(async () => {
  if (props.hit.bvid) {
    const info = await fetchVideoInfo(props.hit.bvid)
    if (info) {
      bilibiliInfo.value = info
    }
  }
})
</script>

<template>
  <button class="quote-card" type="button" @click="emit('select', hit)">
    <div class="quote-media">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        :alt="$t('video.coverAlt', { title: hit.title })"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
      <span class="timestamp">{{ timestamp }}</span>
    </div>
    <div class="quote-body">
      <h3>{{ hit.title }}</h3>
      <p class="quote-text">
        <Highlighter :text="hit.quoteText" :query="query" />
      </p>
      <p v-if="hit.prevText" class="quote-context">← {{ hit.prevText }}</p>
      <p v-if="hit.nextText" class="quote-context">{{ hit.nextText }} →</p>
    </div>
  </button>
</template>
