<template>
    <header ref="rootRef" class="masthead" :class="{ 'trailer-playing': trailerLive, 'is-loading': loading }" :aria-label="loading ? 'Loading...' : `${title} — masthead`">

        <!-- Skeleton Loading state -->
        <div v-if="loading" class="masthead__skeleton-wrapper">
            <div class="masthead__stage masthead__skeleton-shimmer" />
            <div class="container-lm masthead__inner">
                <div class="masthead__content">
                    <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 140px; height: 16px; margin-bottom: 24px; border-radius: 4px" />
                    <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 55%; height: 5.5rem; margin-bottom: 24px; border-radius: 8px" />
                    <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 35%; height: 24px; margin-bottom: 24px; border-radius: 4px" />
                    <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 280px; height: 32px; margin-bottom: 32px; border-radius: 16px" />
                    <div class="masthead__actions">
                        <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                        <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                        <div class="masthead__skeleton-line masthead__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Normal Masthead Content -->
        <template v-else>
            <div class="masthead__stage">
                <template v-if="backdropUrl">
                    <img
                        :key="`masthead-blur-${id}-${backdropPath}`"
                        class="masthead__art--blurred"
                        :src="backdropUrl"
                        alt=""
                        fetchpriority="low"
                        decoding="async"
                        loading="eager"
                    />
                    <div v-if="isVerticalBackdrop" class="masthead__art-fallback-container">
                        <img
                            :key="`masthead-contain-${id}-${backdropPath}`"
                            class="masthead__art--contained"
                            :src="backdropUrl"
                            :alt="title"
                            fetchpriority="high"
                            decoding="async"
                            loading="eager"
                        />
                    </div>
                    <img
                        v-else
                        :key="`masthead-art-${id}-${backdropPath}`"
                        class="masthead__art"
                        :src="backdropUrl"
                        :alt="title"
                        fetchpriority="high"
                        decoding="async"
                        loading="eager"
                    />
                </template>
                <div v-else class="masthead__art masthead__art--placeholder" aria-hidden="true" />

                <TrailerIframe
                    :bind-ref="setIframe"
                    :src="trailerSrc"
                    :visible="trailerVisible"
                    :live="trailerLive"
                    @load="onIframeLoad"
                />

                <div class="masthead__scrim" aria-hidden="true" />
                <div class="masthead__bloom" aria-hidden="true" />
                <div class="masthead__grain grain" aria-hidden="true" />
            </div>

            <TrailerControls
                :visible="trailerLive"
                :paused="userPaused"
                :muted="userMuted"
                @toggle-pause="togglePause"
                @toggle-mute="toggleMute"
            />

            <div class="container-lm masthead__inner">
                <div class="masthead__content">
                    <span class="eyebrow masthead__eyebrow">
                        {{ eyebrow }}
                        <span v-if="year" class="masthead__year">· {{ year }}</span>
                    </span>

                    <h1 class="masthead__title display" data-reveal>{{ title }}</h1>

                    <p v-if="tagline" class="masthead__tagline">
                        <span class="masthead__quote" aria-hidden="true">“</span>{{ tagline }}<span class="masthead__quote" aria-hidden="true">”</span>
                    </p>

                    <ul
                        v-if="audioTags.length || genres.length || ratingLabel"
                        class="masthead__chips"
                    >
                        <li v-if="ratingLabel" class="masthead__rating">
                            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                                <path fill="currentColor" d="M12 2l2.9 6.88L22 9.82l-5.34 4.94L18.18 22 12 18.27 5.82 22l1.52-7.24L2 9.82l7.1-.94z"/>
                            </svg>
                            {{ ratingLabel }}
                        </li>
                        <li
                            v-for="tag in audioTags"
                            :key="`audio-${tag}`"
                            class="masthead__chip masthead__chip--audio"
                            :class="{ 'masthead__chip--english': tag === 'English' }"
                        >
                            {{ tag }}
                        </li>
                        <li v-for="g in genres.slice(0, 4)" :key="g" class="masthead__chip">{{ g }}</li>
                        <li v-if="adult" class="masthead__cert">18+</li>
                    </ul>

                    <div class="masthead__actions">
                        <LmButton 
                            variant="primary" 
                            size="lg" 
                            :aria-label="playLabel"
                            @mouseenter="handlePlayHover"
                            @focus="handlePlayHover"
                            @click="handlePlayClick"
                        >
                            <template #leading>
                                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                    <path fill="currentColor" d="M8 5v14l11-7z"/>
                                </svg>
                            </template>
                            {{ playLabel }}
                        </LmButton>

                        <LmButton
                            variant="outline"
                            size="lg"
                            @click="$emit('trailer')"
                        >
                            <template #leading>
                                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="5" width="18" height="14" rx="2"/>
                                    <path d="M10 9l5 3-5 3z" fill="currentColor"/>
                                </svg>
                            </template>
                            Trailer
                        </LmButton>

                        <LmButton
                            variant="outline"
                            size="lg"
                            class="masthead__icon-action"
                            :icon-only="true"
                            :href="partyHref"
                            rel="nofollow"
                        >
                            <template #leading>
                                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </template>
                        </LmButton>

                        <LmButton
                            variant="outline"
                            size="lg"
                            class="masthead__icon-action"
                            :icon-only="true"
                            :class="{ 'masthead__watchlist-btn--active': inWatchlist }"
                            @click="toggleWatchlist"
                            :aria-label="inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'"
                        >
                            <template #leading>
                                <svg v-if="!inWatchlist" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 5v14M5 12h14"/>
                                </svg>
                                <svg v-else viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="masthead__check-icon">
                                    <path d="m5 13 4 4L19 7"/>
                                </svg>
                            </template>
                        </LmButton>

                        <LmButton
                            v-if="playRoute && type !== 'anime'"
                            variant="outline"
                            size="lg"
                            class="masthead__icon-action"
                            :icon-only="true"
                            :disabled="downloading"
                            @click.prevent="handleDirectDownload"
                            aria-label="Download Media Directly"
                        >
                            <template #leading>
                                <svg v-if="downloading" class="masthead__download-spinner" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="31.4 31.4" stroke-linecap="round">
                                        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                                    </circle>
                                </svg>
                                <svg v-else viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 3v12m0 0l4-4m-4 4l-4-4" />
                                    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                                </svg>
                            </template>
                        </LmButton>
                    </div>
                </div>
            </div>
        </template>

        <!-- Download Quality Selection Modal -->
        <Teleport to="body">
            <Transition name="lm-dialog">
                <div
                    v-if="showDownloadModal"
                    class="masthead__dl-overlay"
                    @click.self="showDownloadModal = false"
                >
                    <div class="masthead__dl-modal" role="dialog" aria-modal="true" aria-label="Select Download Quality">
                        <header class="masthead__dl-header">
                            <div class="masthead__dl-title-group">
                                <h3 class="masthead__dl-title">Download</h3>
                                <p class="masthead__dl-show-name">{{ title }}</p>
                            </div>
                            <button type="button" class="masthead__dl-close" @click="showDownloadModal = false" aria-label="Close">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </header>

                        <!-- TV Show Season & Episode Selector -->
                        <div v-if="isTvShow" class="masthead__dl-picker">
                            <div class="masthead__dl-field">
                                <label class="masthead__dl-label">Season</label>
                                <select v-model.number="selectedSeason" class="masthead__dl-select" @change="onSeasonEpisodeChange">
                                    <option v-for="s in seasonOptions" :key="s.season_number" :value="s.season_number">
                                        Season {{ s.season_number }}
                                    </option>
                                </select>
                            </div>
                            <div class="masthead__dl-field">
                                <label class="masthead__dl-label">Episode</label>
                                <select v-model.number="selectedEpisode" class="masthead__dl-select" @change="onSeasonEpisodeChange">
                                    <option v-for="e in maxEpisodesForSelectedSeason" :key="e" :value="e">
                                        Episode {{ e }}
                                    </option>
                                </select>
                            </div>
                        </div>

                        <!-- Loading State -->
                        <div v-if="isModalLoading" class="masthead__dl-status-state">
                            <svg class="masthead__download-spinner" viewBox="0 0 24 24" width="22" height="22">
                                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="31.4 31.4" stroke-linecap="round">
                                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                                </circle>
                            </svg>
                            <span v-if="isTvShow">Fetching S{{ String(selectedSeason).padStart(2, '0') }}E{{ String(selectedEpisode).padStart(2, '0') }} download links…</span>
                            <span v-else>Fetching {{ title }} download links…</span>
                        </div>

                        <!-- Options List -->
                        <div v-else-if="downloadOptions.length" class="masthead__dl-body">
                            <button
                                v-for="opt in downloadOptions"
                                :key="opt.url"
                                type="button"
                                class="masthead__dl-opt"
                                @click="triggerSingleDownload(opt.url, opt.quality)"
                            >
                                <span
                                    class="masthead__dl-badge"
                                    :class="{
                                        'is-4k': opt.quality.includes('4K') || opt.quality.includes('2160'),
                                        'is-1080': opt.quality.includes('1080'),
                                        'is-720': opt.quality.includes('720')
                                    }"
                                >
                                    {{ opt.quality }}
                                </span>

                                <div class="masthead__dl-opt-info">
                                    <div v-if="opt.filename" class="masthead__dl-filename" :title="opt.filename">
                                        {{ opt.filename }}
                                    </div>
                                    <span class="masthead__dl-meta">
                                        <span
                                            v-if="opt.server"
                                            class="masthead__dl-speed"
                                            :class="opt.server.toLowerCase().includes('10gbps') ? 'is-fast' : 'is-slow'"
                                        >
                                            {{ opt.server.toLowerCase().includes('10gbps') ? '⚡ Fast' : '🐢 Slow' }}
                                        </span>
                                        <span class="masthead__dl-chip">MP4</span>
                                        <template v-if="opt.size && opt.size !== '-'">
                                            <span class="masthead__dl-dot">•</span>
                                            <span class="masthead__dl-size">{{ opt.size }}</span>
                                        </template>
                                        <template v-else-if="!opt.size">
                                            <span class="masthead__dl-dot">•</span>
                                            <span class="masthead__dl-loading">Checking…</span>
                                        </template>
                                    </span>
                                </div>

                                <svg class="masthead__dl-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </button>
                        </div>

                        <!-- Empty State -->
                        <div v-else class="masthead__dl-status-state masthead__dl-status-state--empty">
                            <span v-if="isTvShow">No direct MP4 download links found for S{{ String(selectedSeason).padStart(2, '0') }}E{{ String(selectedEpisode).padStart(2, '0') }}.</span>
                            <span v-else>No direct MP4 download links found for {{ title }}.</span>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </header>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref, toRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import LmButton from '../primitives/Button.vue';
import TrailerControls from '../hero/TrailerControls.vue';
import TrailerIframe from '../hero/TrailerIframe.vue';
import { useAmbientColor } from '@/composables/ui/useAmbientColor';
import { useTrailerEmbed } from '@/composables/media/useTrailerEmbed';
import { warmMooviePlayerAssets } from '@/composables/streaming/useMooviePlayer';
import { catalogDisplayImageSize, useWebImage } from '../../utils/useWebImage';
import { buildPartyHref } from '../../utils/partyRoom';
import { logDownload } from '@/composables/core/useDownloadTracking';
import { isInWatchlist, toggleWatchlistItem, type WatchlistItem } from '@/composables/user/useWatchlist';

export default defineComponent({
    name: 'TitleMasthead',
    components: { LmButton, TrailerControls, TrailerIframe },
    emits: ['trailer'],
    props: {
        id: { type: [Number, String], default: '' },
        partyId: { type: [Number, String], default: null },
        type: { type: String as PropType<'movie' | 'tv' | 'anime'>, default: 'movie' },
        title: { type: String, default: '' },
        tagline: { type: String, default: '' },
        eyebrow: { type: String, default: 'Feature' },
        backdropPath: { type: String as PropType<string | null>, default: null },
        posterPath: { type: String as PropType<string | null>, default: null },
        rating: { type: Number, default: 0 },
        releaseDate: { type: String, default: '' },
        genres: { type: Array as PropType<string[]>, default: () => [] },
        audioTags: { type: Array as PropType<string[]>, default: () => [] },
        genreIds: { type: Array as PropType<number[]>, default: () => [] },
        season: { type: Number, default: 1 },
        episode: { type: Number, default: 1 },
        seasons: { type: Array as PropType<Array<{ season_number: number; episode_count: number; name?: string }>>, default: () => [] },
        adult: { type: Boolean, default: false },
        playRoute: { type: [String, Object] as PropType<string | Record<string, unknown>>, default: '' },
        playLabel: { type: String, default: 'Play' },
        showTrailer: { type: Boolean, default: true },
        loading: { type: Boolean, default: false },
        strictBackdrop: { type: Boolean, default: false }
    },
    setup(props) {
        const router = useRouter();
        const handlePlayClick = () => {
            const route = typeof props.playRoute === 'string' ? props.playRoute : props.playRoute;
            if (route) router.push(route);
        };

        const rootRef = ref<HTMLElement | null>(null);
        const ambientPath = computed(() =>
            props.strictBackdrop ? props.backdropPath : props.backdropPath || props.posterPath
        );
        useAmbientColor(ambientPath, rootRef);

        // Also warm hls.js + hub connection so playback starts instantly
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => void warmMooviePlayerAssets(), { timeout: 1500 });
        } else {
            setTimeout(() => void warmMooviePlayerAssets(), 0);
        }

        const handlePlayHover = () => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => void warmMooviePlayerAssets(), { timeout: 400 });
            } else {
                setTimeout(() => void warmMooviePlayerAssets(), 0);
            }
        };

        const heroArtPath = computed(() =>
            props.strictBackdrop ? props.backdropPath : props.backdropPath || props.posterPath
        );

        const backdropUrl = computed(() => {
            const path = heroArtPath.value;
            if (!path) return '';
            const size = catalogDisplayImageSize(
                path,
                props.backdropPath ? 'hero' : 'large'
            );
            return useWebImage(path, size);
        });

        const isVerticalBackdrop = computed(() => {
            const path = heroArtPath.value;
            if (!path) return false;
            if (props.strictBackdrop && !props.backdropPath) return false;
            if (!props.backdropPath || props.backdropPath === props.posterPath) return true;
            if (path.toLowerCase().includes('cover')) return true;
            return false;
        });

        const year = computed(() => {
            if (!props.releaseDate) return null;
            const parsed = parseInt(props.releaseDate);
            if (!isNaN(parsed) && parsed > 1000 && parsed < 3000) return parsed;
            return new Date(props.releaseDate).getFullYear();
        });

        const ratingLabel = computed(() =>
            props.rating > 0 ? props.rating.toFixed(1) : ''
        );



        const {
            iframeRef,
            trailerVisible,
            trailerLive,
            trailerSrc,
            userPaused,
            userMuted,
            onIframeLoad,
            togglePause,
            toggleMute
        } = useTrailerEmbed({
            id: toRef(props, 'id'),
            type: toRef(props, 'type') as any,
            rootEl: rootRef,
            dwellMs: 3000
        });

        const setIframe = (el: HTMLIFrameElement | null) => {
            iframeRef.value = el;
        };

        const partyHref = computed(() => {
            if (props.type === 'anime' && props.partyId == null) return '';
            return buildPartyHref({
                id: props.id,
                partyId: props.partyId ?? undefined,
                title: props.title,
                type: props.type,
                source: 'global'
            });
        });

        interface DownloadOption {
            quality: string;
            url: string;
            provider: string;
            filename?: string;
            size?: string;
            server?: string;
        }

        const downloading = ref(false);
        const downloadStatus = ref('');
        const showDownloadModal = ref(false);
        const downloadOptions = ref<DownloadOption[]>([]);
        watch(showDownloadModal, (v) => {
            document.body.style.overflow = v ? 'hidden' : '';
        });

        const extractDirectDownloadUrl = (rawUrl: string): string => {
            if (!rawUrl) return '';
            try {
                const fullUrl = rawUrl.startsWith('/') ? `https://watchable-virid.vercel.app${rawUrl}` : rawUrl;
                const u = new URL(fullUrl);
                const embedded = u.searchParams.get('link') || u.searchParams.get('url') || u.searchParams.get('file') || u.searchParams.get('download');
                if (embedded && /^https?:\/\//i.test(embedded)) {
                    return embedded;
                }
                return fullUrl;
            } catch (e) {
                return rawUrl.startsWith('/') ? `https://watchable-virid.vercel.app${rawUrl}` : rawUrl;
            }
        };

        const selectedSeason = ref<number>(props.season || 1);
        const selectedEpisode = ref<number>(props.episode || 1);
        const isModalLoading = ref<boolean>(false);

        watch(() => props.season, (val) => {
            if (val) selectedSeason.value = val;
        });

        watch(() => props.episode, (val) => {
            if (val) selectedEpisode.value = val;
        });

        const isTvShow = computed(() => {
            const t = (props.type || '').toLowerCase();
            return t === 'tv' || t === 'show' || t === 'tv-show' || t === 'tvshow';
        });

        const seasonOptions = computed(() => {
            if (props.seasons && props.seasons.length > 0) {
                const filtered = props.seasons.filter(s => s.season_number > 0);
                if (filtered.length > 0) return filtered;
            }
            return Array.from({ length: 20 }, (_, i) => ({
                season_number: i + 1,
                episode_count: 50
            }));
        });

        const maxEpisodesForSelectedSeason = computed(() => {
            const currentS = seasonOptions.value.find(s => Number(s.season_number) === Number(selectedSeason.value));
            const count = currentS?.episode_count || 50;
            return Array.from({ length: count }, (_, i) => i + 1);
        });

        let activeFetchController: AbortController | null = null;
        let activeEventSources: EventSource[] = [];

        const cancelOngoingStreamFetches = () => {
            if (activeFetchController) {
                console.log('[📥 Abort] Cancelling previous stream fetches...');
                activeFetchController.abort();
                activeFetchController = null;
            }
            activeEventSources.forEach(es => {
                try { es.close(); } catch (e) {}
            });
            activeEventSources = [];
        };

        const fetchStreamsForSelectedEpisode = async (seasonNum: number, episodeNum: number) => {
            // Cancel older fetches immediately!
            cancelOngoingStreamFetches();

            activeFetchController = new AbortController();
            const signal = activeFetchController.signal;

            console.log(`[📥 Download Modal] Quick fetching streams for S${seasonNum}E${episodeNum}...`, { id: props.id, type: props.type, title: props.title });
            isModalLoading.value = true;
            downloadOptions.value = [];

            const id = String(props.id || '').trim();
            const type = isTvShow.value ? 'tv' : 'movie';
            const allOptions: DownloadOption[] = [];

            const updateUIWithOptionBatch = (newOpts: DownloadOption[]) => {
                if (signal.aborted || !newOpts || newOpts.length === 0) return;
                allOptions.push(...newOpts);

                const seenUrls = new Set<string>();
                const clean = allOptions.filter(opt => {
                    if (!opt.url || seenUrls.has(opt.url)) return false;
                    seenUrls.add(opt.url);
                    return true;
                });

                const rankMap: Record<string, number> = { '4K': 100, '2160': 90, '1080': 80, '720': 70, '480': 60, '360': 50 };
                clean.sort((a, b) => {
                    const rA = rankMap[a.quality.replace(/P$/i, '').toUpperCase()] || 0;
                    const rB = rankMap[b.quality.replace(/P$/i, '').toUpperCase()] || 0;
                    return rB - rA;
                });

                if (!signal.aborted) {
                    downloadOptions.value = clean;
                    if (clean.length > 0) {
                        isModalLoading.value = false;
                    }
                    loadOptionSizesParallel(clean);
                }
            };

            // 4KHDHub downloads are served by the dedicated download server.
            const pDownload = fetchProviderStream('4khdhub', id, type, seasonNum, episodeNum, signal)
                .then(res => updateUIWithOptionBatch(res));

            const maxWait = new Promise((resolve) => setTimeout(resolve, 180000));

            try {
                await Promise.race([
                    pDownload,
                    maxWait
                ]);
            } catch (e) {
                console.warn('[Download Modal] Scraper note:', e);
            } finally {
                if (!signal.aborted) {
                    isModalLoading.value = false;
                }
            }
        };

        const onSeasonEpisodeChange = () => {
            console.log(`[📥 Selector] User switched to Season ${selectedSeason.value}, Episode ${selectedEpisode.value}`);
            if (selectedEpisode.value > maxEpisodesForSelectedSeason.value.length) {
                selectedEpisode.value = 1;
            }
            void fetchStreamsForSelectedEpisode(selectedSeason.value, selectedEpisode.value);
        };

        const triggerSingleDownload = (url: string, quality: string) => {
            const finalUrl = extractDirectDownloadUrl(url);
            const titleClean = (props.title || 'media').replace(/[^a-zA-Z0-9_\-]/g, '_');
            let fileName = `${titleClean}_${quality}.mp4`;
            if (isTvShow.value) {
                fileName = `${titleClean}_S${String(selectedSeason.value).padStart(2, '0')}E${String(selectedEpisode.value).padStart(2, '0')}_${quality}.mp4`;
            }
            console.log('[🚀 Trigger Download] Launching direct download:', { fileName, quality, finalUrl });
            const a = document.createElement('a');
            a.href = finalUrl;
            a.download = fileName;
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showDownloadModal.value = false;
            logDownload(props.id, props.type, quality, props.title);
        };

        const handleDirectDownload = async () => {
            if (downloading.value) return;
            console.log('[📥 Main Download Button] Clicked for', props.title);
            selectedSeason.value = props.season || 1;
            selectedEpisode.value = props.episode || 1;
            showDownloadModal.value = true;
            await fetchStreamsForSelectedEpisode(selectedSeason.value, selectedEpisode.value);
        };

        const openDownloadForEpisode = async (seasonNum: number, episodeNum: number) => {
            console.log(`[📥 Episode Card] Opening download modal for S${seasonNum}E${episodeNum}`);
            selectedSeason.value = seasonNum;
            selectedEpisode.value = episodeNum;
            showDownloadModal.value = true;
            await fetchStreamsForSelectedEpisode(seasonNum, episodeNum);
        };

        const fetchProviderStream = async (
            providerId: string,
            tmdbId: string,
            typeStr: string,
            season = 1,
            episode = 1,
            signal?: AbortSignal
        ): Promise<DownloadOption[]> => {
            return new Promise((resolve) => {
                if (signal?.aborted) {
                    return resolve([]);
                }

                const isTv = typeStr === 'tv' || typeStr === 'show' || typeStr === 'tv-show' || typeStr === 'tvshow' || isTvShow.value;
                const normType = isTv ? 'tv' : 'movie';
                // Downloads go through the dedicated download server (4KHDHub only).
                let url = `https://hahaevilcraft.site/download-api/scrape/source?id=${providerId}&tmdbId=${tmdbId}&type=${normType}&title=${encodeURIComponent(props.title || '')}&_cb=${Date.now()}`;
                if (isTv) {
                    url += `&s=${season}&e=${episode}&season=${season}&episode=${episode}&ep=${episode}`;
                }
                const es = new EventSource(url);
                activeEventSources.push(es);

                const options: DownloadOption[] = [];
                let resolved = false;

                let timer: any = null;
                const finish = () => {
                    if (!resolved) {
                        resolved = true;
                        if (timer) clearTimeout(timer);
                        try { es.close(); } catch (e) {}
                        const idx = activeEventSources.indexOf(es);
                        if (idx !== -1) activeEventSources.splice(idx, 1);
                        resolve(options);
                    }
                };

                if (signal) {
                    signal.addEventListener('abort', () => {
                        finish();
                    });
                }

                timer = setTimeout(finish, 180000);

                const parseStreamItem = (item: any) => {
                    if (!item) return;
                    const itemTitle = item.title || item.name || item.filename || '';
                    const mainSzMatch = (itemTitle || item.size || '').match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i);
                    const extractedSize = mainSzMatch ? mainSzMatch[1].toUpperCase() : undefined;

                    const titleClean = (props.title || 'Media').replace(/[^a-zA-Z0-9_\-\.]/g, '.');

                    if (item.qualities) {
                        for (const [qLabel, qObj] of Object.entries(item.qualities as Record<string, any>)) {
                            if (qObj && qObj.url) {
                                const targetUrl = extractDirectDownloadUrl(qObj.url);
                                const qSizeMatch = (qObj.size || qObj.fileSize || qObj.title || '').match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i);
                                const itemSize = qSizeMatch ? qSizeMatch[1].toUpperCase() : extractedSize;

                                let rawName = qObj.filename || qObj.title || item.filename || item.title || item.name || '';
                                if (!rawName || rawName.length < 5) {
                                    if (isTvShow.value) {
                                        rawName = `${titleClean}.S${String(selectedSeason.value).padStart(2, '0')}E${String(selectedEpisode.value).padStart(2, '0')}.${qLabel.toUpperCase()}.WEB-DL.x264.mp4`;
                                    } else {
                                        rawName = `${titleClean}.${qLabel.toUpperCase()}.WEB-DL.x264.mp4`;
                                    }
                                } else if (!/\.(mp4|mkv|avi|mov|webm|wmv|ts|m2ts|rar|zip)$/i.test(rawName)) {
                                    rawName = `${rawName}.mp4`;
                                }

                                options.push({
                                    quality: qLabel.toUpperCase(),
                                    url: targetUrl,
                                    provider: item.provider || 'CineStream',
                                    filename: rawName,
                                    size: itemSize,
                                    server: qObj.server || ''
                                });
                            }
                        }
                    } else if (item.url) {
                        const qualityStr = (item.quality || '1080P').toUpperCase();
                        let rawName = item.filename || item.title || item.name || '';
                        if (!rawName || rawName.length < 5) {
                            if (isTvShow.value) {
                                rawName = `${titleClean}.S${String(selectedSeason.value).padStart(2, '0')}E${String(selectedEpisode.value).padStart(2, '0')}.${qualityStr}.WEB-DL.x264.mp4`;
                            } else {
                                rawName = `${titleClean}.${qualityStr}.WEB-DL.x264.mp4`;
                            }
                        } else if (!/\.(mp4|mkv|avi|mov|webm|wmv|ts|m2ts|rar|zip)$/i.test(rawName)) {
                            rawName = `${rawName}.mp4`;
                        }

                        options.push({
                            quality: qualityStr,
                            url: extractDirectDownloadUrl(item.url),
                            provider: item.provider || 'CineStream',
                            filename: rawName,
                            size: extractedSize || (item.size ? String(item.size).toUpperCase() : undefined),
                            server: item.server || ''
                        });
                    }
                };

                es.onmessage = (evt) => {
                    if (evt.data === '[DONE]') {
                        finish();
                        return;
                    }
                    try {
                        const data = JSON.parse(evt.data);
                        // Download server streams one flat option object per message.
                        if (data && data.url && !data.stream && !data.streams) {
                            parseStreamItem(data);
                            return;
                        }
                        const streamList = data.stream || data.streams || [];
                        for (const item of (Array.isArray(streamList) ? streamList : [streamList])) {
                            parseStreamItem(item);
                        }
                    } catch (e) {}
                };

                es.addEventListener('update', (evt: any) => {
                    try {
                        const data = JSON.parse(evt.data);
                        if (data.status === 'notfound' || data.status === 'failure') {
                            finish();
                        }
                    } catch (e) {}
                });

                es.addEventListener('completed', (evt: any) => {
                    try {
                        const data = JSON.parse(evt.data);
                        const streamList = data.stream || data.streams || [];
                        for (const item of (Array.isArray(streamList) ? streamList : [streamList])) {
                            parseStreamItem(item);
                        }
                    } catch (e) {}
                    finish();
                });

                es.onerror = finish;
            });
        };

        const fetchExactFileSize = async (rawUrl: string): Promise<string> => {
            if (!rawUrl) return '';
            try {
                const targetUrl = extractDirectDownloadUrl(rawUrl);
                try {
                    const u = new URL(targetUrl);
                    const querySz = u.searchParams.get('size') || u.searchParams.get('sz') || u.searchParams.get('filesize');
                    if (querySz && /(\d+(?:\.\d+)?\s*(?:GB|MB))/i.test(querySz)) {
                        return querySz.toUpperCase();
                    }
                } catch (e) {}

                const proxyUrl = `/api/stream/proxy?url=${encodeURIComponent(targetUrl)}&_size=1&_t=${Date.now()}`;
                
                let res = await fetch(proxyUrl, { headers: { Range: 'bytes=0-0' }, cache: 'no-store', signal: AbortSignal.timeout(5000) }).catch(() => null);
                if (!res || !res.ok) {
                    res = await fetch(proxyUrl, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(5000) }).catch(() => null);
                }
                if (res) {
                    const cr = res.headers.get('content-range') || res.headers.get('Content-Range');
                    const len = res.headers.get('content-length') || res.headers.get('Content-Length') || res.headers.get('x-file-size');
                    let totalBytes = 0;
                    if (cr && cr.includes('/')) {
                        totalBytes = parseInt(cr.split('/')[1], 10);
                    } else if (len) {
                        totalBytes = parseInt(len, 10);
                    }
                    if (totalBytes > 0) {
                        const gb = totalBytes / (1024 * 1024 * 1024);
                        if (gb >= 0.9) return `${gb.toFixed(1)} GB`;
                        const mb = totalBytes / (1024 * 1024);
                        return `${mb.toFixed(0)} MB`;
                    }
                }
            } catch (e) {}
            return '';
        };

        const loadOptionSizesParallel = (opts: DownloadOption[]) => {
            const targets = opts.filter(opt => !opt.size || opt.size === '-');
            if (targets.length === 0) return;

            console.log(`[📥 Parallel Size Fetch] Querying file sizes in parallel for ${targets.length} options...`);

            void Promise.allSettled(targets.map(async (opt) => {
                const sz = await fetchExactFileSize(opt.url);
                if (sz) {
                    opt.size = sz;
                    downloadOptions.value = [...downloadOptions.value];
                }
            }));
        };

        const inWatchlist = computed(() => {
            if (!props.id) return false;
            return isInWatchlist(props.id, props.type);
        });

        const toggleWatchlist = () => {
            if (!props.id || !props.title) return;
            const item: WatchlistItem = {
                id: props.id,
                title: props.title,
                image: props.posterPath || props.backdropPath || null,
                rating: props.rating || 0,
                categories: props.genreIds || [],
                adult: props.adult || false,
                type: props.type
            };
            toggleWatchlistItem(item);
        };

        return {
            rootRef,
            backdropUrl,
            isVerticalBackdrop,
            year,
            ratingLabel,
            setIframe,
            downloading,
            downloadStatus,
            showDownloadModal,
            downloadOptions,
            isTvShow,
            triggerSingleDownload,
            handleDirectDownload,
            openDownloadForEpisode,
            selectedSeason,
            selectedEpisode,
            isModalLoading,
            seasonOptions,
            maxEpisodesForSelectedSeason,
            onSeasonEpisodeChange,
            trailerVisible,
            trailerLive,
            trailerSrc,
            userPaused,
            userMuted,
            onIframeLoad,
            togglePause,
            toggleMute,
            partyHref,
            handlePlayHover,
            handlePlayClick,
            inWatchlist,
            toggleWatchlist
        };
    }
});
</script>

<style lang="scss" scoped>
.masthead {
    position: relative;
    isolation: isolate;
    min-height: clamp(480px, 60vh, 680px);
    color: var(--bone-50);
    display: flex;
    align-items: flex-end;
    overflow: hidden;

    &__stage {
        position: absolute;
        inset: 0;
        z-index: 0;
    }

    &__art {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 22%;
        filter: blur(0.5px);
        transition: opacity var(--dur-slow) var(--ease-out);

        &--placeholder {
            background: radial-gradient(70% 70% at 50% 40%, var(--ink-700), var(--ink-900));
        }
    }

    &.trailer-playing &__art,
    &.trailer-playing &__art--blurred,
    &.trailer-playing &__art-fallback-container { opacity: 0; }

    &__art-fallback-container {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ink-950);
        transition: opacity var(--dur-slow) var(--ease-out);
    }

    &__art--blurred {
        position: absolute;
        inset: -40px;
        width: calc(100% + 80px);
        height: calc(100% + 80px);
        object-fit: cover;
        filter: blur(30px) brightness(0.2) saturate(1.2);
        opacity: 0.9;
        z-index: 0;
        pointer-events: none;
    }

    &__art--contained {
        position: relative;
        z-index: 2;
        max-width: 90%;
        max-height: 95%;
        width: auto;
        height: 100%;
        object-fit: contain;
        object-position: center;
        border-radius: var(--r-md, 8px);
        // Keep poster key art under the same quiet, readable tint as the
        // billboard hero, especially when a vertical poster is used as the
        // detail-page backdrop fallback.
        filter: brightness(0.68) saturate(0.9);
        box-shadow: 0 12px 60px rgba(0, 0, 0, 0.95);
    }

    &__scrim {
        position: absolute;
        inset: 0;
        background:
            linear-gradient(180deg, rgba(11,10,8,0.6) 0%, rgba(11,10,8,0) 25%, rgba(11,10,8,0) 55%, rgba(11,10,8,0.8) 88%, var(--ink-900) 100%),
            radial-gradient(120% 90% at 0% 100%, rgba(11,10,8,0.7), rgba(11,10,8,0) 55%);
        pointer-events: none;
    }

    &__bloom {
        position: absolute;
        left: -5%;
        bottom: -10%;
        width: 70%;
        height: 70%;
        background: radial-gradient(closest-side, rgba(var(--ambient, 255 90 31), 0.18), transparent 70%);
        filter: blur(40px);
        pointer-events: none;
    }

    &__grain {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.6;
    }

    &__inner {
        position: relative;
        z-index: 1;
        padding-block: clamp(var(--s-6), 6vh, var(--s-10));
        padding-inline: var(--s-6);
    }

    &__crumb {
        position: fixed;
        top: calc(var(--site-header-height) + var(--s-3));
        left: max(var(--container-gutter), calc((100vw - var(--container-max)) / 2 + var(--container-gutter)));
        z-index: calc(var(--z-header) - 1);
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--bone-200);
        margin: 0;
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        cursor: pointer;
        text-decoration: none;
        transition: color var(--dur-fast) var(--ease-out);
        text-shadow: 0 1px 12px rgba(11, 10, 8, 0.85);

        &.is-dimmed { opacity: 0.45; }

        &:hover, &:focus-visible { color: var(--ember); }

        span { transition: transform var(--dur-fast) var(--ease-out); }
        &:hover span { transform: translateX(-3px); }
    }

    &__content {
        max-width: 960px;
    }

    &__eyebrow {
        color: var(--ember);
        display: inline-flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: var(--s-3);
    }

    &__year {
        color: var(--bone-400);
        font-family: var(--font-mono);
        letter-spacing: 0.05em;
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(2.2rem, 4.5vw, 4.2rem);
        line-height: 1.0;
        letter-spacing: -0.02em;
        font-variation-settings: 'opsz' 144, 'SOFT' 30;
        color: var(--bone-50);
        margin: 0;
        text-wrap: balance;
        max-width: 22ch;
    }

    &__tagline {
        font-family: var(--font-display);
        font-style: italic;
        font-size: clamp(0.95rem, 1.2vw, 1.25rem);
        color: var(--bone-200);
        margin: var(--s-4) 0 0;
        max-width: 54ch;
        line-height: 1.35;
    }

    &__quote {
        color: var(--ember);
        font-size: 1.2em;
        line-height: 0;
        vertical-align: -0.15em;
        padding-inline: 0.1em;
    }

    &__chips {
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-2);
        margin: var(--s-5) 0 0;
        padding: 0;
        font-size: var(--fs-xs);

        li {
            padding: 0.35rem 0.7rem;
            border: 1px solid var(--rule);
            border-radius: var(--r-pill);
            color: var(--bone-200);
            background: rgba(245, 239, 228, 0.04);
            backdrop-filter: blur(6px);
        }
    }

    &__chip {
        font-family: var(--font-mono);
        text-transform: uppercase;
        letter-spacing: 0.1em;

        &--audio {
            text-transform: none;
            letter-spacing: 0.06em;
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.22);
        }

        &--english {
            color: var(--bone-50);
            background: rgba(96, 165, 250, 0.14);
            border-color: rgba(96, 165, 250, 0.42);
        }
    }

    &__rating {
        color: var(--gold-leaf) !important;
        border-color: rgba(201, 167, 106, 0.35) !important;
        display: inline-flex !important;
        align-items: center;
        gap: 0.35rem;

        svg { color: var(--gold-leaf); }
    }

    &__cert {
        font-family: var(--font-mono);
        font-weight: 600;
    }

    &__actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-3);
        margin-top: var(--s-6);
    }


    @media (max-width: 720px) {
        min-height: clamp(380px, 50vh, 520px);

        &__actions { margin-top: var(--s-5); }
    }
}

.masthead__skeleton-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.masthead__skeleton-line {
    background: var(--ink-750);
}

.masthead__skeleton-shimmer {
    position: relative;
    overflow: hidden;
    background: var(--ink-750);

    &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.04),
            transparent
        );
        transform: translateX(-100%);
        animation: masthead-skeleton-shimmer-anim 1.6s infinite ease-in-out;
    }
}

@keyframes masthead-skeleton-shimmer-anim {
    100% {
        transform: translateX(100%);
    }
}

.masthead__dl-overlay {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(4, 5, 8, 0.84);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
}

.masthead__dl-modal {
    position: relative;
    background: linear-gradient(165deg, rgba(20, 22, 30, 0.96) 0%, rgba(10, 11, 16, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    width: 100%;
    max-width: 420px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-shadow: 0 32px 80px -16px rgba(0, 0, 0, 0.9);

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 15%;
        right: 15%;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 120, 30, 0.8), transparent);
    }
}

.masthead__dl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}

.masthead__dl-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--bone-50);
    margin: 0;
}

.masthead__dl-close {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.22s ease;
    flex-shrink: 0;

    &:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.14);
        border-color: rgba(255, 255, 255, 0.25);
        transform: rotate(90deg);
    }
}

.masthead__dl-body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 4px; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18); border-radius: 4px; }
}

.masthead__dl-opt {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;

    &:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 107, 0, 0.4);
    }

    &:active {
        transform: scale(0.98);
    }
}

.masthead__dl-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    font-weight: 800;
    padding: 4px 9px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: #e2e2e8;
    border: 1px solid rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
    min-width: 48px;

    &.is-4k {
        background: linear-gradient(135deg, rgba(255, 190, 0, 0.24), rgba(255, 107, 0, 0.24));
        color: #ffd000;
        border-color: rgba(255, 190, 0, 0.45);
        box-shadow: 0 0 16px rgba(255, 190, 0, 0.2);
    }
    &.is-1080 {
        background: rgba(56, 189, 248, 0.18);
        color: #38bdf8;
        border-color: rgba(56, 189, 248, 0.35);
    }
    &.is-720 {
        background: rgba(192, 132, 252, 0.18);
        color: #c084fc;
        border-color: rgba(192, 132, 252, 0.35);
    }
}

.masthead__dl-opt-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
}

.masthead__dl-filename {
    font-family: var(--font-mono, monospace);
    font-size: 0.78rem;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.35;
}

.masthead__dl-meta {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    flex: 1;
    min-width: 0;
}

.masthead__dl-chip {
    font-family: var(--font-mono, monospace);
    font-size: 0.65rem;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.7);
    padding: 1px 5px;
    border-radius: 4px;
    flex-shrink: 0;
}

.masthead__dl-speed {
    font-family: var(--font-mono, monospace);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    flex-shrink: 0;
}

.masthead__dl-speed.is-fast {
    color: #34d399;
    background: rgba(16, 185, 129, 0.14);
    border: 1px solid rgba(16, 185, 129, 0.35);
}

.masthead__dl-speed.is-slow {
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
}

.masthead__dl-dot {
    color: rgba(255, 255, 255, 0.25);
    flex-shrink: 0;
}

.masthead__dl-size {
    color: #ff9d54;
    font-weight: 700;
    background: rgba(255, 107, 0, 0.14);
    border: 1px solid rgba(255, 107, 0, 0.25);
    padding: 1px 6px;
    border-radius: 4px;
    flex-shrink: 0;
}

.masthead__dl-loading {
    color: rgba(255, 255, 255, 0.35);
    font-style: italic;
}

.masthead__dl-arrow {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.4);
    transition: color 0.2s, transform 0.2s;
}

.masthead__dl-opt:hover .masthead__dl-arrow {
    color: #ff6b00;
    transform: translateY(2px);
}

.masthead__dl-title-group {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
}

.masthead__dl-show-name {
    font-size: 0.8rem;
    color: var(--bone-300, rgba(255, 255, 255, 0.6));
    margin: 2px 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

.masthead__dl-picker {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    width: 100%;
}

.masthead__dl-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.masthead__dl-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #ff9d54;
}

.masthead__dl-select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-color: rgba(255, 255, 255, 0.06);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.6)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 10px;
    color: #fff;
    font-size: 0.82rem;
    font-weight: 500;
    padding: 7px 30px 7px 10px;
    outline: none;
    cursor: pointer;
    width: 100%;
    min-width: 0;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    transition: border-color 0.2s, background-color 0.2s;

    &:hover, &:focus {
        border-color: rgba(255, 107, 0, 0.6);
        background-color: rgba(255, 255, 255, 0.1);
    }

    option {
        background: #14161e;
        color: #fff;
        font-size: 0.85rem;
    }
}

.masthead__dl-status-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 32px 16px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.86rem;
    text-align: center;

    &--empty {
        color: rgba(255, 255, 255, 0.4);
    }
}

@media (max-width: 520px) {
    .masthead__dl-overlay {
        padding: 0;
        align-items: flex-end;
    }
    .masthead__dl-modal {
        max-width: 100%;
        max-height: 82vh;
        max-height: 82dvh;
        border-radius: 20px 20px 0 0;
        padding: 16px 14px 20px;
        box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.8);
    }
    .masthead__dl-header {
        margin-bottom: 12px;
    }
    .masthead__dl-title {
        font-size: 1rem;
    }
    .masthead__dl-picker {
        gap: 8px;
        margin-bottom: 12px;
        padding-bottom: 10px;
    }
    .masthead__dl-select {
        font-size: 0.78rem;
        padding: 7px 24px 7px 8px;
        border-radius: 8px;
    }
    .masthead__dl-opt {
        padding: 10px 12px;
        gap: 10px;
        border-radius: 12px;
    }
    .masthead__dl-badge {
        font-size: 0.7rem;
        padding: 3px 7px;
        min-width: 42px;
    }
    .masthead__dl-meta {
        font-size: 0.7rem;
    }
}
</style>
