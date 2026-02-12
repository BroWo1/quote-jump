<script setup>
import { computed } from 'vue'
import { formatTimestamp } from '../lib/text.js'

const props = defineProps({
  video: { type: Object, required: true },
  startTime: { type: Number, default: 0 },
})

const timestamp = computed(() => formatTimestamp(props.startTime))
const bilibiliUrl = computed(() => {
  const seconds = Math.max(0, Math.floor(props.startTime))
  return `https://www.bilibili.com/video/${props.video.bvid}?t=${seconds}`
})

const embedUrl = computed(() => {
  const seconds = Math.max(0, Math.floor(props.startTime))
  return `https://player.bilibili.com/player.html?bvid=${props.video.bvid}&t=${seconds}&autoplay=0&high_quality=1&danmaku=0`
})
</script>

<template>
  <section class="video-panel">
    <header>
      <p class="panel-label">{{ $t('video.label') }}</p>
      <h2>{{ video.title }}</h2>
    </header>
    <div class="video-shell">
      <div class="embed-frame">
        <iframe
          class="video-embed"
          :src="embedUrl"
          :title="$t('video.playerTitle', { title: video.title })"
          allow="autoplay; fullscreen"
          allowfullscreen
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>
      <div class="video-actions">
        <div class="timestamp-chip">{{ timestamp }}</div>
        <a class="primary-button" :href="bilibiliUrl" target="_blank" rel="noopener">{{ $t('actions.openBilibili') }}</a>
      </div>
      <p class="helper-text">{{ $t('video.embedNote') }}</p>
    </div>
  </section>
</template>
