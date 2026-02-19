<script setup>
import { computed } from 'vue'
import { formatTimestamp } from '../lib/text.js'

const props = defineProps({
  video: { type: Object, required: true },
  startTime: { type: Number, default: 0 },
  quotes: { type: Array, default: () => [] },
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

const downloadTranscript = () => {
  const title = props.video.title || 'transcript'
  const lines = [`# ${title}`, '']
  for (const quote of props.quotes) {
    lines.push(`**${formatTimestamp(quote.start)}** ${quote.text}`, '')
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}.md`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="video-panel">
    <header class="video-header">
      <img class="video-header-logo" src="/quoteTrans.png" alt="quoteTrans logo" />
      <div class="video-header-copy">
        <p class="panel-label">{{ $t('video.label') }}</p>
        <h2>{{ video.title }}</h2>
      </div>
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
        <button type="button" class="download-button" @click="downloadTranscript">{{ $t('actions.downloadTranscript') }}</button>
      </div>
    </div>
  </section>
</template>
