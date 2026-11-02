<template>
    <div class="watch-stage">
        <header class="watch-stage__chrome">
            <div class="watch-stage__chrome-inner">
                <div class="watch-stage__crumb">
                    <p class="eyebrow">Hub Player</p>
                </div>

                <h1 v-if="activeTitle" class="watch-stage__title">{{ activeTitle }}</h1>
                <span v-else class="watch-stage__title-skeleton" aria-hidden="true" />

                <div class="watch-stage__actions">
                    <div class="scraper-badge">
                        <span v-if="timing" class="scraper-badge__time">{{ timing }}ms</span>
                        <span v-if="totalStreams" class="scraper-badge__providers">{{ totalStreams }}s</span>
                    </div>
                </div>
            </div>
        </header>

        <main class="watch-stage__main">
            <div class="split-layout">
                <div class="split-layout__player">
                    <div class="search-bar">
                        <div class="search-bar__input-wrap">
                            <input
                                v-model="searchQuery"
                                type="text"
                                placeholder="TMDB ID or search title…"
                                class="search-bar__input"
                                autocomplete="off"
                                @keydown.enter="doSearch"
                            />
                        </div>
                        <div class="search-bar__opts">
                            <select v-model="mediaType" class="search-bar__select">
                                <option value="movie">Movie</option>
                                <option value="tv">TV</option>
                            </select>
                            <label class="search-bar__opt">
                                <span>S</span>
                                <input v-model="season" type="number" min="0" placeholder="0" />
                            </label>
                            <label class="search-bar__opt">
                                <span>E</span>
                                <input v-model="episode" type="number" min="0" placeholder="0" />
                            </label>
                        </div>
                        <button type="button" class="search-bar__go" :disabled="loading" @click="doSearch">
                            {{ loading ? '…' : 'Search' }}
                        </button>
                    </div>

                    <div ref="bloomRef" class="player-frame" :class="{ 'has-error': playbackError }">
                        <div v-if="activeStreamUrl" class="player-frame__bloom" aria-hidden="true" />
                        <div v-if="activeStreamUrl" ref="artContainer" class="player-frame__art" />

                        <div v-if="loading && !activeStreamUrl" class="player-frame__overlay">
                            <div class="player-frame__skeleton" aria-hidden="true" />
                            <div class="player-frame__loader">
                                <div class="player-frame__spinner" aria-hidden="true" />
                                <p class="meta">Searching providers…</p>
                            </div>
                        </div>

                        <div v-if="!activeStreamUrl && !loading && !playbackError && !searched" class="player-frame__overlay">
                            <p class="eyebrow">Search a title</p>
                            <h3>Hub Player</h3>
                            <p class="meta">watchable-virid.vercel.app</p>
                        </div>

                        <div v-if="!activeStreamUrl && !loading && searched && !playbackError && results.length === 0" class="player-frame__overlay">
                            <p class="eyebrow">No results</p>
                            <h3>No streams found</h3>
                            <p class="meta">Try a different search</p>
                        </div>

                        <div v-if="playbackError && !loading" class="player-frame__overlay player-frame__overlay--error">
                            <p class="eyebrow">Error</p>
                            <h3>{{ playbackError }}</h3>
                            <button type="button" class="search-bar__go" @click="doSearch">Retry</button>
                        </div>
                    </div>
                </div>

                <div class="split-layout__side">
                    <div v-if="results.length" class="side-section side-section--results">
                        <div class="side-section__head">
                            <p class="eyebrow">Streams · {{ totalStreams }} total</p>
                            <button type="button" class="pill-btn" @click="clearResults">Clear</button>
                        </div>
                        <div class="stream-list">
                            <div v-for="group in results" :key="group.provider" class="stream-group">
                                <div class="stream-group__head">
                                    <span class="stream-group__name">{{ group.providerName }}</span>
                                    <span class="stream-group__count">{{ group.streams.length }}</span>
                                </div>
                                <div
                                    v-for="(stream, i) in group.streams"
                                    :key="i"
                                    class="stream-row"
                                >
                                    <button
                                        type="button"
                                        class="stream-row__play"
                                        :class="{ 'is-active': activeStreamUrl === streamUrl(stream) }"
                                        @click="playStream(stream)"
                                    >
                                        ▶
                                    </button>
                                    <div class="stream-row__info">
                                        <span class="stream-row__quality">{{ stream.quality || 'Auto' }}</span>
                                        <span class="stream-row__name">{{ stream.name || 'Stream' }}</span>
                                        <span class="stream-row__type">{{ stream.type }}</span>
                                    </div>
                                    <button
                                        type="button"
                                        class="stream-row__copy"
                                        title="Copy URL"
                                        @click="copyUrl(stream)"
                                    >
                                        📋
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="!results.length && searched" class="side-section">
                        <p class="eyebrow" style="padding: var(--s-4); text-align: center; color: var(--bone-400);">
                            No providers returned results
                        </p>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { defineComponent, onUnmounted, ref } from 'vue'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { useHubScraper, type HubStream } from '@/composables/streaming/useHubScraper'
import { usePlaybackRoute } from '@/composables/streaming/usePlaybackRoute'
import { getSyncClient } from '../lib/syncClient'

export default defineComponent({
    name: 'PlayerHub',
    setup() {
        const { loading, error, results, totalStreams, search } = useHubScraper()

        let adminProxyEnabled = true
        let proxyFetched = false
        const { routeProxyEnabled } = usePlaybackRoute()

        async function ensureProxySetting() {
            if (proxyFetched) return
            proxyFetched = true
            try {
                const client = await getSyncClient()
                const { data } = await client.from('app_settings').select('value').eq('key', 'stream_proxy_enabled').single()
                if (data) adminProxyEnabled = data.value === 'true'
            } catch { /* keep default */ }
        }

        function shouldUseProxy(stream: HubStream): boolean {
            if (stream.proxyMode === 'on') return true
            if (stream.proxyMode === 'off') return false
            return routeProxyEnabled(adminProxyEnabled)
        }

        function streamUrl(s: HubStream): string {
            // Provider-side proxies (emebd / workers.dev) already relay the origin
            // fetch — never wrap them through the hub again (double hops + 522s).
            const alreadyProxied = Boolean(
                s.url?.startsWith(`${HUB_PROXY}?`) ||
                s.url?.startsWith('/api/stream/proxy?') ||
                s.url?.includes('vercel.app/api/stream/proxy?') ||
                /\.workers\.dev\/|\/v1\/proxy\?data=|\/proxy\?data=/.test(s.url || '')
            )
            if (!alreadyProxied && shouldUseProxy(s) && s.proxyUrl) return s.proxyUrl
            if (!alreadyProxied && shouldUseProxy(s) && s.headers && Object.keys(s.headers).length) {
                const u = btoa(s.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
                const h = btoa(JSON.stringify(s.headers)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
                return `${HUB_PROXY}?u=${u}&h=${h}`
            }
            return s.url
        }

        const searchQuery = ref('550')
        const mediaType = ref('movie')
        const season = ref('')
        const episode = ref('')
        const searched = ref(false)
        const timing = ref<number | null>(null)
        const activeStreamUrl = ref('')
        const activeTitle = ref('')
        const playbackError = ref('')
        const artContainer = ref<HTMLElement | null>(null)
        const bloomRef = ref<HTMLElement | null>(null)

        let plyrInstance: Plyr | null = null
        let hlsInstance: any = null

        const HUB_PROXY = '/api/stream/proxy'

        const loadHlsJs = (() => {
            let promise: Promise<void> | null = null
            return () => {
                if ((window as any).Hls) return Promise.resolve()
                if (promise) return promise
                promise = new Promise((resolve) => {
                    const script = document.createElement('script')
                    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'
                    script.onload = () => resolve()
                    script.onerror = () => resolve()
                    document.head.appendChild(script)
                })
                return promise
            }
        })()

        function destroyPlayer() {
            if (plyrInstance) {
                try { plyrInstance.destroy() } catch {}
                plyrInstance = null
            }
            if (hlsInstance) {
                try { hlsInstance.destroy() } catch {}
                hlsInstance = null
            }
            if (artContainer.value) {
                artContainer.value.innerHTML = ''
            }
        }

        async function mountPlayer(url: string) {
            const container = artContainer.value
            if (!container) return
            destroyPlayer()

            await loadHlsJs()
            const HlsCtor = (window as any).Hls
            const isHls = url.includes('.m3u8') || url.includes('m3u8')

            const video = document.createElement('video')
            video.controls = false
            video.playsInline = true
            video.autoplay = true
            video.className = 'plyr-video-element'
            container.appendChild(video)

            if (isHls && HlsCtor && HlsCtor.isSupported()) {
                hlsInstance = new HlsCtor({
                    enableWorker: true,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                })
                hlsInstance.loadSource(url)
                hlsInstance.attachMedia(video)
            } else {
                video.src = url
            }

            plyrInstance = new Plyr(video, {
                autoplay: true,
                controls: [
                    'play-large', 'play', 'progress', 'current-time',
                    'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen',
                ],
                settings: ['quality', 'speed'],
            })
        }

        async function playStream(stream: HubStream) {
            await ensureProxySetting()
            let playUrl = streamUrl(stream)
            activeStreamUrl.value = playUrl
            activeTitle.value = `${stream._providerName} · ${stream.quality || 'Auto'}`
            playbackError.value = ''
            try {
                await mountPlayer(playUrl)
            } catch (e) {
                if (playUrl === stream.url && stream.proxyUrl && shouldUseProxy(stream)) {
                    console.debug('[MoovieFrame] direct playback failed, falling back to proxy:', stream.proxyUrl)
                    activeStreamUrl.value = stream.proxyUrl
                    await mountPlayer(stream.proxyUrl)
                } else {
                    playbackError.value = 'Playback failed'
                }
            }
        }

        function copyUrl(stream: HubStream) {
            navigator.clipboard.writeText(streamUrl(stream)).catch(() => {})
        }

        function clearResults() {
            results.value = []
            totalStreams.value = 0
            searched.value = false
            activeStreamUrl.value = ''
            activeTitle.value = ''
            destroyPlayer()
        }

        async function doSearch() {
            const q = searchQuery.value.trim()
            if (!q) return
            searched.value = true
            playbackError.value = ''
            activeStreamUrl.value = ''
            activeTitle.value = ''
            destroyPlayer()

            const started = performance.now()
            await search(q, mediaType.value, season.value || undefined, episode.value || undefined)
            timing.value = Math.round(performance.now() - started)

            if (error.value) {
                playbackError.value = error.value
            }
        }

        onUnmounted(() => {
            destroyPlayer()
        })

        return {
            searchQuery, mediaType, season, episode,
            loading, results, totalStreams, searched,
            timing, activeStreamUrl, activeTitle, playbackError,
            artContainer, bloomRef,
            doSearch, playStream, copyUrl, streamUrl, clearResults,
        }
    },
})
</script>

<style scoped lang="scss">
.watch-stage {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__chrome {
        position: sticky;
        top: 0;
        z-index: var(--z-header);
        background: linear-gradient(180deg, rgba(11,10,8,0.95), rgba(11,10,8,0.6) 70%, rgba(11,10,8,0));
        backdrop-filter: blur(14px);

        @media (min-width: 1024px) {
            position: fixed;
            left: 0;
            right: 0;
        }
    }

    &__chrome-inner {
        max-width: var(--container-max);
        margin: 0 auto;
        padding: var(--s-3) var(--s-4);
        display: grid;
        grid-template-columns: auto 1fr auto;
        grid-template-areas: 'crumb title actions';
        align-items: center;
        gap: var(--s-3) var(--s-4);

        @media (min-width: 768px) { padding: var(--s-4) var(--s-5); }
        @media (max-width: 640px) {
            grid-template-columns: auto 1fr;
            grid-template-areas: 'crumb actions';
            padding: var(--s-2) var(--s-3);
            gap: var(--s-2);
        }
    }

    &__crumb {
        grid-area: crumb;
        display: inline-flex;
        align-items: center;
        gap: var(--s-3);
        min-width: 0;
        @media (max-width: 1023px) { gap: var(--s-2); .eyebrow { display: none !important; } }
    }

    &__back {
        all: unset;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 50%;
        background: var(--surface-tint);
        cursor: pointer;
        color: var(--bone-100);
        transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
        @media (max-width: 640px) { width: 36px; height: 36px; }

        &:hover { background: var(--ember); color: var(--ink-900); transform: translateX(-2px); }
        svg { width: 18px; height: 18px; }
    }

    &__title {
        grid-area: title;
        margin: 0;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-lg);
        letter-spacing: var(--ls-tight);
        color: var(--bone-50);
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        @media (min-width: 768px) { font-size: var(--fs-xl); }
        @media (max-width: 1023px) { display: none !important; }
    }

    &__title-skeleton {
        grid-area: title;
        display: block;
        height: 18px;
        max-width: 280px;
        margin: 0 auto;
        background: var(--surface-tint);
        border-radius: var(--r-pill);
        @media (max-width: 1023px) { display: none !important; }
    }

    &__actions {
        grid-area: actions;
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        justify-content: flex-end;
    }

    &__main {
        display: grid;
        gap: 0;
    }
}

.scraper-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border-radius: var(--r-pill);
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    &__time { color: var(--ember); }
    &__providers { color: var(--bone-400); }
}

.split-layout {
    display: flex;
    gap: var(--s-3);
    max-width: var(--container-max);
    width: 100%;
    margin: 0 auto;
    padding: var(--s-1) var(--s-3) calc(var(--s-9) + env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;

    @media (min-width: 1024px) {
        padding: 72px var(--s-4) var(--s-4);
        min-height: 100dvh;
    }

    @media (max-width: 1023px) {
        flex-direction: column;
        padding: var(--s-2);
    }

    &__player {
        flex: 0 0 55%;
        min-width: 0;

        @media (min-width: 1024px) {
            position: sticky;
            top: 72px;
            align-self: start;
        }

        @media (max-width: 1023px) {
            flex: none;
            width: 100%;
        }
    }

    &__side {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
        max-height: calc(100dvh - 80px);
        overflow-y: auto;

        @media (max-width: 1023px) {
            max-height: none;
            overflow-y: visible;
        }

        &::-webkit-scrollbar { width: 4px; }
        &::-webkit-scrollbar-track { background: transparent; }
        &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: var(--r-pill); }
    }
}

.search-bar {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    margin-bottom: var(--s-2);
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-1) var(--s-2);

    &:focus-within { border-color: var(--ember); }

    &__input-wrap {
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;
    }

    &__input {
        flex: 1;
        background: transparent;
        border: 0;
        padding: var(--s-1);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        outline: none;
        &::placeholder { color: var(--bone-400); }
    }

    &__select {
        background: rgba(255,255,255,0.06);
        border: 1px solid var(--rule);
        border-radius: 4px;
        padding: 0.2rem 0.4rem;
        color: var(--bone-50);
        font-size: 10px;
        font-family: var(--font-mono);
        outline: none;
        cursor: pointer;
        &:focus { border-color: var(--ember); }
    }

    &__opts {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    &__opt {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-size: 10px;
        color: var(--bone-400);
        span { font-family: var(--font-mono); }

        input[type='number'] {
            width: 28px;
            background: rgba(255,255,255,0.06);
            border: 1px solid var(--rule);
            border-radius: 4px;
            padding: 0.15rem 0.2rem;
            color: var(--bone-50);
            font-size: 10px;
            text-align: center;
            outline: none;
            &:focus { border-color: var(--ember); }
        }
    }

    &__go {
        padding: 0.25rem 0.7rem;
        border: 0;
        border-radius: var(--r-pill);
        background: var(--ember);
        color: var(--ink-900);
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
        transition: background-color var(--dur-fast);
        &:hover { background: var(--ember-600); }
        &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
}

.player-frame {
    position: relative;
    aspect-ratio: 16 / 9;
    background: #000;
    border-radius: var(--r-lg);
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--rule);

    &__bloom {
        position: absolute;
        inset: -10% -5%;
        background: radial-gradient(ellipse at center, rgba(255, 255, 255,0.08) 0%, transparent 70%);
        filter: blur(60px);
        opacity: 0.5;
        z-index: -1;
        pointer-events: none;
        &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse at center, transparent 0%, var(--ink-900) 78%);
        }
    }

    &__art {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }

    &__overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        gap: var(--s-2);
        text-align: center;
        background: var(--ink-900);
        z-index: 5;

        h3 {
            font-family: var(--font-display);
            font-size: var(--fs-base);
            color: var(--bone-50);
            margin: 0;
        }

        &--error h3 { color: #ff8f8f; }
    }

    &__skeleton {
        position: absolute;
        inset: 0;
        background: linear-gradient(100deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0) 70%) var(--ink-800);
        background-size: 220% 100%;
        animation: shimmer 2.4s infinite ease-in-out;
    }

    &__loader {
        position: relative;
        z-index: 1;
        display: grid;
        gap: var(--s-2);
        justify-items: center;
        color: var(--bone-200);
    }

    &__spinner {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px solid var(--rule-strong);
        border-top-color: var(--ember);
        animation: spin 1.1s linear infinite;
    }
}

@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
@keyframes spin {
    to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
    .player-frame__skeleton,
    .player-frame__spinner { animation: none !important; }
}

.meta {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin: 0;
}

.eyebrow {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--bone-400);
    margin: 0;
}

.side-section {
    background: rgba(10, 16, 28, 0.6);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-2) var(--s-2);

    &__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-2);
        margin-bottom: var(--s-2);
        padding: 0 var(--s-1);
    }

    &--results {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;

        .side-section__head { flex-shrink: 0; }
    }
}

.pill-btn {
    all: unset;
    cursor: pointer;
    padding: 0.15rem 0.5rem;
    border-radius: var(--r-pill);
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--rule);
    color: var(--bone-300);
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    transition: all var(--dur-fast);
    white-space: nowrap;
    &:hover { background: rgba(255,255,255,0.1); border-color: var(--bone-400); }
}

.stream-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    overflow-y: auto;
    flex: 1;
    padding-right: var(--s-1);

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: var(--r-pill); }
}

.stream-group {
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    overflow: hidden;

    &__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--s-1) var(--s-2);
        background: rgba(255,255,255,0.03);
        border-bottom: 1px solid var(--rule);
    }

    &__name {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: 11px;
        color: var(--bone-50);
    }

    &__count {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--bone-400);
    }
}

.stream-row {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-1) var(--s-2);
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background var(--dur-fast);

    &:last-child { border-bottom: 0; }
    &:hover { background: rgba(255,255,255,0.03); }

    &__play {
        all: unset;
        cursor: pointer;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        background: rgba(255,255,255,0.06);
        display: grid;
        place-items: center;
        font-size: 11px;
        flex-shrink: 0;
        transition: all var(--dur-fast);
        border: 1px solid transparent;

        &:hover { background: var(--ember); color: var(--ink-900); }
        &.is-active {
            background: var(--ember);
            color: var(--ink-900);
            border-color: var(--ember-600);
        }
    }

    &__info {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: var(--s-2);
    }

    &__quality {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        color: var(--ember);
        white-space: nowrap;
        flex-shrink: 0;
    }

    &__name {
        font-family: var(--font-ui);
        font-size: 11px;
        color: var(--bone-200);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__type {
        font-family: var(--font-mono);
        font-size: 8px;
        text-transform: uppercase;
        color: var(--bone-400);
        flex-shrink: 0;
    }

    &__copy {
        all: unset;
        cursor: pointer;
        font-size: 12px;
        opacity: 0.4;
        flex-shrink: 0;
        transition: opacity var(--dur-fast);
        &:hover { opacity: 1; }
    }
}
</style>
