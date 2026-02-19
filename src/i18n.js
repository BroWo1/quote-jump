import { createI18n } from 'vue-i18n'

export const LOCALE_STORAGE_KEY = 'quote-jump-locale'

const messages = {
  en: {
    app: {
      name: 'Quote Jump',
      tagline: 'A Live Stream AI Transcript Search Engine',
    },
    search: {
      placeholder: 'Search quotes…',
      button: 'Jump',
    },
    status: {
      indexing: 'Indexing {loaded} / {total} transcripts…',
      ready: '{quotes} quotes across {videos} videos',
      error: 'Index unavailable — check manifest or transcripts.',
      preparing: 'Preparing index…',
      hits: '{count} hits',
    },
    empty: {
      noResults: 'No results found',
      missingVideo: "We couldn't find this video in the manifest.",
      loadingManifest: 'Loading manifest and transcripts…',
    },
    actions: {
      loadMore: 'Load more quotes',
      backToResults: 'Back to results',
      closeModal: 'Close modal',
      openBilibili: 'Open on Bilibili',
      downloadTranscript: 'Download transcript',
    },
    transcript: {
      title: 'Transcript',
      count: '{count} quote units',
    },
    video: {
      label: 'Video jump',
      playerTitle: '{title} player',
      coverAlt: '{title} cover',
      embedNote: 'The embed uses the same timestamp as the jump link.',
    },
    controls: {
      language: 'Language',
      streamer: 'Streamer',
    },
    language: {
      label: 'Language',
      english: 'English',
      chinese: '中文',
    },
  },
  zh: {
    app: {
      name: '言论索引',
      tagline: '一个直播AI字幕搜索引擎',
    },
    search: {
      placeholder: '搜索字幕…',
      button: '跳转',
    },
    status: {
      indexing: '正在索引 {loaded} / {total} 条字幕…',
      ready: '共 {quotes} 条言论，来自 {videos} 个视频',
      error: '索引不可用——请检查清单或字幕文件。',
      preparing: '正在准备索引…',
      hits: '{count} 条匹配',
    },
    empty: {
      noResults: '没有找到结果',
      missingVideo: '清单中找不到该视频。',
      loadingManifest: '正在加载清单和字幕…',
    },
    actions: {
      loadMore: '加载更多字幕',
      backToResults: '返回结果',
      closeModal: '关闭弹窗',
      openBilibili: '在哔哩哔哩打开',
      downloadTranscript: '下载字幕',
    },
    transcript: {
      title: '字幕',
      count: '{count} 条字幕',
    },
    video: {
      label: '视频跳转',
      playerTitle: '{title} 播放器',
      coverAlt: '{title} 封面',
      embedNote: '嵌入播放器使用与跳转链接相同的时间点。',
    },
    controls: {
      language: '语言',
      streamer: '主播',
    },
    language: {
      label: '语言',
      english: 'English',
      chinese: '中文',
    },
  },
}

const supportedLocales = ['en', 'zh']

const normalizeLocale = (locale) => {
  if (!locale) return 'en'
  const normalized = locale.toLowerCase()
  if (normalized.startsWith('zh')) return 'zh'
  return 'en'
}

const getStoredLocale = () => {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(LOCALE_STORAGE_KEY)
}

const getBrowserLocale = () => {
  if (typeof navigator === 'undefined') return null
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of languages) {
    const candidate = normalizeLocale(language)
    if (supportedLocales.includes(candidate)) return candidate
  }
  return 'en'
}

const initialLocale = getStoredLocale() || getBrowserLocale() || 'en'

export const i18n = createI18n({
  legacy: false,
  locale: supportedLocales.includes(initialLocale) ? initialLocale : 'en',
  fallbackLocale: 'en',
  messages,
  globalInjection: true,
})
