<script setup>
import { computed } from 'vue'
import { splitForHighlight } from '../lib/text.js'

const props = defineProps({
  text: { type: String, default: '' },
  query: { type: String, default: '' },
})

const parts = computed(() => splitForHighlight(props.text, props.query))
</script>

<template>
  <span>
    <span
      v-for="(part, index) in parts"
      :key="`${index}-${part.text}`"
      :class="['hl-part', { 'hl-hit': part.match }]"
    >
      {{ part.text }}
    </span>
  </span>
</template>

<style scoped>
.hl-part {
  white-space: pre-wrap;
}

.hl-hit {
  background: var(--accent-soft);
  color: var(--ink-strong);
  padding: 0.05em 0.2em;
  border-radius: 6px;
}
</style>
