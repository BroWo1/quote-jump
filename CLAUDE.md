# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quote Jump is a Vue 3 SPA for searching Bilibili live stream transcripts. It features a Web Worker-powered hybrid search engine (BM25 + character n-gram semantic similarity) with bilingual support (English/Chinese).

## Commands

- **Dev server**: `npm run dev` (Vite with HMR)
- **Build**: `npm run build` (outputs to dist/)
- **Preview**: `npm run preview`
- **Deploy**: `npx wrangler deploy` (Cloudflare Workers)

No test or lint commands are configured.

## Architecture

### Routing

Uses a **custom lightweight router** (`src/lib/router.js`) instead of vue-router. A shim at `src/lib/vue-router-shim.js` provides `useRoute()`/`useRouter()` API compatibility. Vite aliases `vue-router` to this shim. Routes:
- `/search?q=<query>` → `SearchResults.vue`
- `/v/<bvid>?t=<timestamp>&q=<query>&quote=<quoteId>` → `QuoteDetail.vue`

### State Management

Pinia store (`src/stores/quotes.js`) manages manifest data, search state, transcripts cache, and Web Worker lifecycle. LocalStorage keys: `quote-jump-locale`, `quote-jump-streamer`.

### Search Engine (Web Worker)

`src/workers/indexer.worker.js` (~800 lines) is the core search engine running in a Web Worker. It:
- Builds an inverted index from transcript JSON files in `public/transcripts/`
- Uses hybrid scoring: 74% BM25 lexical + 26% character n-gram semantic similarity
- Caches the index in IndexedDB (schema version 2)
- Communicates via postMessage: `init`, `search`, `getTranscript` → emits `progress`, `ready`, `results`, `transcript`, `error`

### Data Flow

1. App loads `public/manifest.json` (video metadata)
2. Store spawns Web Worker which fetches all transcripts and builds/restores search index
3. Search queries go to worker, which returns ranked results
4. Individual transcripts loaded on demand for detail view

### UI Layer

- **Nuxt UI** (`@nuxt/ui` v4) for components
- **Tailwind CSS** v4 for styling
- **vue-i18n** for English/Chinese i18n (`src/i18n.js`)

### Deployment

Cloudflare Workers via `wrangler.toml`. Static assets from `dist/` with SPA fallback. Worker (`src/worker.js`) handles `/api/*` routes. Dev server proxies `/api/bilibili` to Bilibili's API for CORS bypass.

### Key Aliases (vite.config.js)

- `@` → `./src`
- `vue-router` → `./src/lib/vue-router-shim.js`
