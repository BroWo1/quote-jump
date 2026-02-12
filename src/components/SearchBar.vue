<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'submit'])
const value = ref(props.modelValue)
const { t } = useI18n({ useScope: 'global' })
const placeholderText = computed(() => props.placeholder || t('search.placeholder'))

watch(
  () => props.modelValue,
  (next) => {
    if (next !== value.value) value.value = next
  }
)

const submit = () => {
  emit('submit', value.value.trim())
}
</script>

<template>
  <form class="search-bar" @submit.prevent="submit">
    <!--<label class="search-label" for="search-input">Search transcript</label>-->
    <div class="search-input">
      <input
        v-model="value"
        type="search"
        autocomplete="off"
        spellcheck="false"
        :placeholder="placeholderText"
        @input="emit('update:modelValue', value)"
      />
      <button type="submit">{{ t('search.button') }}</button>
    </div>
  </form>
</template>
