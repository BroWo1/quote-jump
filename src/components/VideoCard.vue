<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchVideoInfo } from '../lib/bilibili.js'

const props = defineProps({
  video: { type: Object, required: true },
})

const emit = defineEmits(['select'])

const bilibiliInfo = ref(null)

const coverUrl = computed(() => {
  if (bilibiliInfo.value?.coverUrl) {
    return bilibiliInfo.value.coverUrl
  }
  return props.video.coverUrl || null
})

const title = computed(() => {
  if (bilibiliInfo.value?.title) {
    return bilibiliInfo.value.title
  }
  return props.video.title
})

onMounted(async () => {
  if (props.video.bvid) {
    const info = await fetchVideoInfo(props.video.bvid)
    if (info) {
      bilibiliInfo.value = info
    }
  }
})
</script>

<template>
  <button class="video-card" type="button" @click="emit('select', video)">
    <div class="video-card-media">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        :alt="$t('video.coverAlt', { title })"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
      <div v-else class="video-card-placeholder">
        <span>{{ video.bvid }}</span>
      </div>
    </div>
    <div class="video-card-body">
      <h3>{{ title }}</h3>
      <p v-if="video.date" class="video-card-date">{{ video.date }}</p>
    </div>
  </button>
</template>
