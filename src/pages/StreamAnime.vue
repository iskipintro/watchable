<template>
    <div
        class="watch-stage"
        :class="{ 'is-embed': isEmbed, 'controls-visible': controlsVisible }"
        @mousemove="showControls"
        @mouseleave="scheduleHide"
        @touchstart.passive="showControls"
        @click="showControls"
    >
        <!--
            Mouse-capture layer: when controls are hidden the iframe swallows
            all pointer events and @mousemove on the stage never fires.
            This transparent div sits above the iframe only while controls are
            hidden, catches the first pointermove, shows controls, then gets
            pointer-events: none again so the iframe is usable.
        -->
        <div
            v-if="!controlsVisible"
            class="watch-stage__capture"
            @pointermove.passive="showControls"
            @touchstart.passive="showControls"
            @click="showControls"
        />

        <!-- Full-screen video layer -->
        <div class="watch-stage__video-layer">
            <MoovieFrame
                ref="frameRef"
                :media-id="animeId"
                :anilist-id="anilistIdRef || animeId"
                media-type="anime"
                :season="activeTmdbSeason"
                :episode="currentEpisode"
                :title="animeTitle || 'Anime'"
                :backdrop-path="tmdbBackdropPath"
                :poster-path="tmdbPosterPath"
                :audio-mode="activeLanguage"
                @embed-change="onEmbedChange"
                @next-episode="goToNextEpisode"
                @prev-episode="goToPreviousEpisode"
            />
        </div>

        <!-- TOP overlay: gradient + back + title + episode nav + server -->
        <div v-if="!isEmbed" class="watch-stage__top-overlay">
            <div class="watch-stage__top-bar">
                <div class="watch-stage__top-left">
                    <button
                        type="button"
                        class="watch-stage__back"
                        aria-label="Back to anime"
                        title="Back to anime"
                        @click="goBack"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5" />
                            <path d="m12 19-7-7 7-7" />
                        </svg>
                    </button>
                    <div class="watch-stage__breadcrumb">
                        <span class="watch-stage__breadcrumb-sep">·</span>
                        <h1 v-if="tmdbShow" class="watch-stage__title">{{ animeTitle }}</h1>
                        <span v-else class="watch-stage__title-skeleton" aria-hidden="true" />
                    </div>
                    <!-- Episode navigation pill -->
                    <div class="watch-stage__ep-nav">
                        <button
                            type="button"
                            class="watch-stage__nav-btn"
                            :disabled="currentEpisode <= seasonFirstEpisode"
                            @click="goToPreviousEpisode"
                            aria-label="Previous Episode"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                                <path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                        <span class="watch-stage__ep-code" @click="openEpisodePicker">
                            <span class="watch-stage__ep-code-full">Episode {{ getEpisodeInSeasonNumber(currentEpisode) }}</span>
                            <span class="watch-stage__ep-code-short">Ep {{ getEpisodeInSeasonNumber(currentEpisode) }}</span>
                        </span>
                        <button
                            type="button"
                            class="watch-stage__nav-btn"
                            :disabled="isLastEpisode"
                            @click="goToNextEpisode"
                            aria-label="Next Episode"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                                <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="watch-stage__top-right">
                    <!-- Language toggle -->
                    <div class="watch-stage__lang-pill">
                        <button
                            type="button"
                            class="watch-stage__lang-pill-btn"
                            :class="{ 'is-active': activeLanguage === 'sub' }"
                            @click="changeLanguage('sub')"
                        >
                            SUB
                        </button>
                        <button
                            type="button"
                            class="watch-stage__lang-pill-btn"
                            :class="{ 'is-active': activeLanguage === 'dub' }"
                            @click="changeLanguage('dub')"
                        >
                            DUB
                        </button>
                    </div>

                    <ServerAccordion
                        variant="dropdown"
                        :servers="availableServers"
                        :active-server-index="activeServerIndex"
                        @server-change="onServerChange"
                    />

                    <button
                        v-if="animeTitle || animeId"
                        type="button"
                        class="watch-stage__party-btn watch-stage__watchlist-btn"
                        :class="{ 'is-added': inWatchlist }"
                        :title="inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'"
                        @click="toggleWatchlist"
                    >
                        <svg v-if="!inWatchlist" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="watch-stage__party-icon">
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="watch-stage__party-icon">
                            <path d="m5 13 4 4L19 7"/>
                        </svg>
                        <span class="watch-stage__party-label">{{ inWatchlist ? 'In Watchlist' : 'Watchlist' }}</span>
                    </button>

                    <template v-if="seasonsList.length > 1 || true">
                        <details class="watch-stage__options">
                            <summary class="watch-stage__options-trigger">
                                <span>Options</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </summary>
                            <div class="watch-stage__options-menu">
                                <div v-if="seasonsList.length > 1" class="watch-stage__option-group">
                                    <label class="eyebrow watch-stage__option-label" for="anime-season-select">
                                        Season / Arc
                                    </label>
                                    <select
                                        id="anime-season-select"
                                        :value="activeSeasonSelectValue"
                                        class="watch-stage__option-select"
                                        @change="goToSeason(Number(($event.target as HTMLSelectElement).value))"
                                    >
                                        <option
                                            v-for="s in seasonsList"
                                            :key="s.id"
                                            :value="s.id"
                                        >
                                            {{ s.label }}
                                        </option>
                                    </select>
                                </div>
                                <div
                                    class="watch-stage__option-group"
                                >
                                    <p class="eyebrow watch-stage__option-label">Language Pref</p>
                                    <div class="watch-stage__language-tabs">
                                        <button
                                            type="button"
                                            class="watch-stage__language-btn"
                                            :class="{ 'is-active': activeLanguage === 'sub' }"
                                            @click="activeLanguage = 'sub'"
                                        >
                                            Subtitled
                                        </button>
                                        <button
                                            type="button"
                                            class="watch-stage__language-btn"
                                            :class="{ 'is-active': activeLanguage === 'dub' }"
                                            @click="activeLanguage = 'dub'"
                                        >
                                            Dubbed
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </details>
                    </template>

                    <button
                        type="button"
                        class="watch-stage__fullscreen-btn"
                        :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
                        @click="toggleFullscreen"
                    >
                        <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="watch-stage__fullscreen-icon">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="watch-stage__fullscreen-icon">
                            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </button>

                    <a
                        v-if="tmdbShow && partyHref"
                        :href="partyHref"
                        class="watch-stage__party-btn"
                        title="Watch Together"
                        rel="nofollow"
                        @click.prevent="handleWatchTogether"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="watch-stage__party-icon">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span class="watch-stage__party-label">Watch Together</span>
                    </a>
                </div>
            </div>
        </div>

        <!-- Up-Next drawer -->
        <UpNextDrawer
            v-if="availableSeasons.length && !isFullscreen"
            ref="upNextDrawerRef"
            :current-season="navigatorSeason"
            :current-episode="currentEpisode"
            :season-episodes="seasonEpisodes"
            :next-season-number="nextSeasonNumber"
            :next-season-episodes="nextSeasonEpisodes"
            :is-loading="isLoadingEpisodes"
            :seasons="seasonsDropdownList"
            :preview-episodes="previewEpisodes"
            :is-preview-loading="isPreviewLoading"
            @select="onUpNextSelect"
            @season-change="onUpNextSeasonChange"
            @preview-season="onPreviewSeason"
        />

        <!-- Scrollable content below the fixed video -->
        <div v-if="!isEmbed && tmdbShow" class="watch-stage__rack">
            <div class="watch-stage__mobile-episodes">
                <EpisodeNavigator
                    :available-seasons="availableSeasons"
                    :season-episodes="seasonEpisodes"
                    :current-season="navigatorSeason"
                    :current-episode="currentEpisode"
                    :show-id="animeId"
                    :is-loading-episodes="isLoadingEpisodes"
                    :preview-episodes="previewEpisodes"
                    :is-preview-loading="isPreviewLoading"
                    media-type="anime"
                    @season-change="onPreviewSeason"
                    @select="onMobileEpisodeSelect"
                    @previous="goToPreviousEpisode"
                    @next="goToNextEpisode"
                />
            </div>
            <CommentsSection :media-id="animeId" media-type="anime" />
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAniList } from '@/composables/media/useAniList';
import { saveProgress } from '@/composables/user/useProgress';
import { addViewedItem } from '@/composables/user/useHistory';
import { animeServers } from '@/composables/streaming/useStream';
import { Episode } from '@/composables/media/useTvShows';
import MoovieFrame from '../components/player/MoovieFrame.vue';
import ServerAccordion from '../components/player/ServerAccordion.vue';
import UpNextDrawer from '../components/player/UpNextDrawer.vue';
import { useAppPaths } from '@/composables/ui/useAppPaths';
import { isInWatchlist, toggleWatchlistItem, type WatchlistItem } from '@/composables/user/useWatchlist';
import CommentsSection from '../components/player/CommentsSection.vue';
import EpisodeNavigator from '../components/player/EpisodeNavigator.vue';
import {
    partitionStreamSeasonEpisodes,
    sortEpisodes,
    type EpisodeLike
} from '../utils/episodeAvailability';
import {
    estimateAnimeEpisodeTotal,
    findTmdbSeasonTabForEpisode,
    getCachedAnimeTmdbArtwork,
    getCachedTmdbArtworkByTmdbId,
    resolveAnimeRouteIds,
    resolveAnilistIdForPlayback,
    resolveAnimeTmdbMeta,
    resolveAnimeTmdbEpisodesByTmdbId,
    resolveAnimeTmdbMetaByTmdbId,
    resolvePreferredTmdbSeason,
    fetchTmdbAnimeShowDetails,
    type AnimeTmdbArtwork,
    type AnimeTmdbEpisode,
    type TmdbAnimeShowDetails
} from '@/composables/media/useAnimeTmdbArtwork';
import { useWebImage } from '../utils/useWebImage';
import { buildStreamPartyHref } from '../utils/partyRoom';

export default defineComponent({
    name: 'StreamAnime',
    components: {
        ServerAccordion,
        MoovieFrame,
        UpNextDrawer,
        CommentsSection,
        EpisodeNavigator
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const paths = useAppPaths();
        const { fetchAnimeById } = useAniList();

        const animeId = ref<number>(Number(route.params.id));
        const tmdbShow = ref<TmdbAnimeShowDetails | null>(null);
        const anilistIdRef = ref<number | null>(null);
        const anilistPlaybackMeta = ref<{
            status?: string | null;
            nextAiringEpisode?: { episode?: number | null } | null;
        } | null>(null);
        const currentEpisode = ref<number>(1);
        const activeServerIndex = ref<number>(0);
        const activeLanguage = ref<'sub' | 'dub'>('sub');
        const suppressRouteReload = ref(false);
        let loadGeneration = 0;

        const tmdbArtwork = ref<AnimeTmdbArtwork | null>(null);
        const isLoadingTmdb = ref(false);
        const isLoadingEpisodes = ref(false);
        const seasonEpisodes = ref<Episode[]>([]);
        const nextSeasonEpisodes = ref<Episode[]>([]);
        const nextAiringEpisode = ref<Episode | null>(null);
        const activeTmdbSeason = ref(1);

        const usesTmdbSeasonTabs = computed(() => tmdbArtwork.value?.usesTmdbSeasonTabs ?? false);

        const tmdbEpisodes = computed(() => tmdbArtwork.value?.episodes ?? []);

        const tmdbPosterPath = computed(() => {
            const path = tmdbArtwork.value?.posterPath;
            return path ? useWebImage(path, 'medium') : '';
        });

        const tmdbBackdropPath = computed(() => {
            const path = tmdbArtwork.value?.backdropPath || tmdbArtwork.value?.posterPath;
            return path ? useWebImage(path, 'large') : '';
        });

        const browsableTmdbEpisodes = computed(() => sortEpisodes(tmdbEpisodes.value));

        const getEpisodeInSeasonNumber = (epNum: number) => {
            const match = tmdbEpisodes.value.find(e => e.episode_number === epNum);
            return match ? match.episode_in_season : epNum;
        };

        const animeTitle = computed(() => tmdbShow.value?.name || '');

        const frameRef = ref<InstanceType<typeof MoovieFrame> | null>(null);

        const availableServers = animeServers;

        const onServerChange = (index: number) => {
            activeServerIndex.value = index;
            const target = availableServers.value[index];
            if (target && frameRef.value?.selectServer) {
                frameRef.value.selectServer(target.name);
            }
        };

        watch(() => frameRef.value?.selectedServer, (name) => {
            if (!name) return;
            const idx = availableServers.value.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
            if (idx !== -1) {
                activeServerIndex.value = idx;
            }
        });

        const changeLanguage = (lang: 'sub' | 'dub') => {
            activeLanguage.value = lang;
            if (frameRef.value?.changeAudioMode) {
                frameRef.value.changeAudioMode(lang);
            }
        };

        const embedActive = ref(false);
        const onEmbedChange = (val: boolean) => {
            embedActive.value = val;
        };

        const globalMaxEpisode = computed(() =>
            estimateAnimeEpisodeTotal(
                tmdbEpisodes.value,
                tmdbArtwork.value?.totalEpisodeCount ?? 0,
                anilistPlaybackMeta.value?.nextAiringEpisode?.episode ?? 0
            )
        );



        const syncSeasonTabForEpisode = (ep: number) => {
            if (!usesTmdbSeasonTabs.value) return;
            const tab = findTmdbSeasonTabForEpisode(ep, tmdbArtwork.value?.seasonTabs ?? []);
            if (tab) activeTmdbSeason.value = tab.seasonNumber;
        };

        const activeTmdbSeasonTab = computed(() => {
            if (!usesTmdbSeasonTabs.value) return null;
            return tmdbArtwork.value?.seasonTabs.find((tab) => tab.seasonNumber === activeTmdbSeason.value) ?? null;
        });

        const seasonEpisodeBounds = computed(() => {
            if (usesTmdbSeasonTabs.value && activeTmdbSeasonTab.value) {
                return {
                    first: activeTmdbSeasonTab.value.firstEpisode,
                    last: activeTmdbSeasonTab.value.lastEpisode
                };
            }
            const total = estimateAnimeEpisodeTotal(
                tmdbEpisodes.value,
                tmdbArtwork.value?.totalEpisodeCount ?? 0
            );
            return { first: 1, last: total };
        });

        const seasonFirstEpisode = computed(() => seasonEpisodeBounds.value.first);
        const seasonLastEpisode = computed(() => seasonEpisodeBounds.value.last);

        const totalEpisodes = computed(() => {
            if (isLoadingTmdb.value && !tmdbArtwork.value?.totalEpisodeCount && !tmdbEpisodes.value.length) {
                return 0;
            }
            return seasonLastEpisode.value - seasonFirstEpisode.value + 1;
        });

        const availableSeasons = computed(() => {
            if (usesTmdbSeasonTabs.value && tmdbArtwork.value?.seasonTabs.length) {
                return tmdbArtwork.value.seasonTabs.map((tab) => ({
                    id: tab.seasonNumber,
                    season_number: tab.seasonNumber,
                    episode_count: tab.lastEpisode - tab.firstEpisode + 1,
                    name: tab.label
                }));
            }
            return [{
                id: 1,
                season_number: 1,
                episode_count: Math.max(globalMaxEpisode.value, currentEpisode.value),
                name: 'Episodes'
            }];
        });

        const nextAiringInfo = computed(() => {
            if (!nextAiringEpisode.value) return null;
            const ep = nextAiringEpisode.value;
            const date = new Date(ep.air_date);
            const dateString = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            return {
                episode: ep.episode_number,
                dateString,
                name: ep.name
            };
        });

        const navigatorSeason = computed(() =>
            usesTmdbSeasonTabs.value ? activeTmdbSeason.value : 1
        );

        const isNavigatingToParty = ref(false);

        const isEmbed = computed(() => Boolean(route.meta.bareLayout));

        const controlsVisible = ref(true);
        let hideTimer: ReturnType<typeof setTimeout> | null = null;

        const showControls = () => {
            controlsVisible.value = true;
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                controlsVisible.value = false;
            }, 3000);
        };

        const scheduleHide = () => {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                controlsVisible.value = false;
            }, 800);
        };

        const isFullscreen = ref(false);

        const toggleFullscreen = async () => {
            if (!document.fullscreenElement) {
                try {
                    await document.documentElement.requestFullscreen();
                    isFullscreen.value = true;
                } catch {
                    isFullscreen.value = false;
                }
            } else {
                try {
                    await document.exitFullscreen();
                    isFullscreen.value = false;
                } catch {
                    isFullscreen.value = true;
                }
            }
        };

        const onFullscreenChange = () => {
            isFullscreen.value = !!document.fullscreenElement;
        };

        const isAnimeplayServer = computed(() => false);

        const currentEmbedUrl = computed(() => '');

        const resolvedAnilistId = computed(() => anilistIdRef.value);

        const partyHref = computed(() => {
            const anilistId = resolvedAnilistId.value;
            if (!anilistId) return '';
            return buildStreamPartyHref({
                id: anilistId,
                partyId: anilistId,
                title: `${animeTitle.value} - Episode ${currentEpisode.value}`,
                type: 'anime',
                episode: currentEpisode.value
            });
        });

        const seasonsList = computed(() => {
            if (!usesTmdbSeasonTabs.value || !tmdbArtwork.value?.seasonTabs.length) return [];
            return tmdbArtwork.value.seasonTabs.map((tab) => ({
                id: tab.seasonNumber,
                label: tab.label
            }));
        });

        const activeSeasonSelectValue = computed(() => activeTmdbSeason.value);

        const seasonsDropdownList = computed(() => {
            return availableSeasons.value.map((s) => ({
                number: s.season_number,
                label: s.name || `Season ${s.season_number}`
            }));
        });

        const goToSeason = (id: number) => {
            activeTmdbSeason.value = id;
            const tab = tmdbArtwork.value?.seasonTabs.find((s) => s.seasonNumber === id);
            if (tab) goToEpisode(tab.firstEpisode);
        };

        const onSeasonChange = async (seasonNum: number) => {
            if (navigatorSeason.value === seasonNum) {
                await loadSeason();
                return;
            }
            activeTmdbSeason.value = seasonNum;
            const tab = tmdbArtwork.value?.seasonTabs.find((s) => s.seasonNumber === seasonNum);
            currentEpisode.value = tab?.firstEpisode ?? 1;
            syncSeasonTabForEpisode(currentEpisode.value);
            await loadSeason();
        };

        const applyTmdbArtwork = (
            cached: AnimeTmdbArtwork | null,
            generation: number,
            anilistHintId?: number | null
        ) => {
            if (generation !== loadGeneration) return;
            if (!cached) return;
            tmdbArtwork.value = cached;

            const preferredSeason = resolvePreferredTmdbSeason(cached, anilistHintId);
            if (preferredSeason) {
                activeTmdbSeason.value = preferredSeason;
            }

            if (cached.usesTmdbSeasonTabs && cached.seasonTabs.length) {
                const tabs = cached.seasonTabs;
                const preferredTab = preferredSeason
                    ? tabs.find((tab) => tab.seasonNumber === preferredSeason)
                    : null;
                if (preferredTab) {
                    activeTmdbSeason.value = preferredTab.seasonNumber;
                } else {
                    syncSeasonTabForEpisode(currentEpisode.value);
                    const activeTab = tabs.find((tab) => tab.seasonNumber === activeTmdbSeason.value);
                    if (!activeTab) {
                        activeTmdbSeason.value = tabs[0].seasonNumber;
                    }
                }
            }
        };

        const loadTmdbArtworkByTmdbId = async (tmdbId: number, generation: number) => {
            isLoadingTmdb.value = true;
            let meta: Awaited<ReturnType<typeof resolveAnimeTmdbMetaByTmdbId>> = null;
            try {
                meta = await resolveAnimeTmdbMetaByTmdbId(tmdbId);
                if (generation !== loadGeneration) return;
                if (meta) {
                    applyTmdbArtwork(meta, generation, anilistIdRef.value);
                }
            } catch (err) {
                console.error('Failed to fetch TMDB meta for anime:', err);
                if (generation === loadGeneration) {
                    tmdbArtwork.value = null;
                }
            } finally {
                if (generation === loadGeneration) {
                    isLoadingTmdb.value = false;
                }
            }

            try {
                let episodes = await resolveAnimeTmdbEpisodesByTmdbId(tmdbId);
                if (generation !== loadGeneration) return;

                if (!episodes.length) {
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    if (generation !== loadGeneration) return;
                    episodes = await resolveAnimeTmdbEpisodesByTmdbId(tmdbId);
                }
                if (generation !== loadGeneration) return;

                applyTmdbArtwork(
                    getCachedTmdbArtworkByTmdbId(tmdbId) || meta,
                    generation,
                    anilistIdRef.value
                );
                if (generation === loadGeneration) {
                    await loadSeason();
                }
            } catch (err) {
                console.error('Failed to fetch TMDB episodes for anime:', err);
                if (generation === loadGeneration) {
                    seasonEpisodes.value = [];
                    isLoadingEpisodes.value = false;
                }
            }
        };

        const loadAnilistPlaybackMeta = async (anilistId: number) => {
            try {
                const response = await fetchAnimeById(anilistId);
                const media = response?.data?.Media;
                if (media) {
                    anilistPlaybackMeta.value = {
                        status: media.status,
                        nextAiringEpisode: media.nextAiringEpisode
                    };
                }
            } catch (err) {
                console.warn('Failed to load AniList playback meta:', err);
            }
        };

        const parseAnilistIdFromRoute = (): number | null => {
            const raw = route.query.ani;
            const value = Array.isArray(raw) ? raw[0] : raw;
            const parsed = Number(value);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        };

        const loadAnime = async (routeId: number) => {
            const generation = ++loadGeneration;
            seasonEpisodes.value = [];
            nextSeasonEpisodes.value = [];
            nextAiringEpisode.value = null;
            try {
                const { tmdbId: resolvedTmdbId, anilistId } = await resolveAnimeRouteIds(routeId, async (id) => {
                    try {
                        const res = await fetchAnimeById(id);
                        return res?.data?.Media ?? null;
                    } catch {
                        return null;
                    }
                });
                if (generation !== loadGeneration) return;

                let tmdbId = resolvedTmdbId;
                animeId.value = tmdbId;
                anilistIdRef.value = anilistId;

                if (!anilistIdRef.value) {
                    anilistIdRef.value = await resolveAnilistIdForPlayback(tmdbId);
                }

                if (!anilistIdRef.value) {
                    anilistIdRef.value = parseAnilistIdFromRoute();
                }

                if (tmdbId !== routeId) {
                    suppressRouteReload.value = true;
                    await router.replace(
                        paths.streamAnime(tmdbId, currentEpisode.value, anilistIdRef.value)
                    );
                }
                if (generation !== loadGeneration) return;

                await loadTmdbArtworkByTmdbId(tmdbId, generation);
                if (generation !== loadGeneration) return;

                if (!tmdbArtwork.value?.tmdbId && anilistIdRef.value) {
                    const cached = getCachedAnimeTmdbArtwork(anilistIdRef.value);
                    if (cached?.tmdbId && cached.tmdbId !== tmdbId) {
                        tmdbId = cached.tmdbId;
                        animeId.value = tmdbId;
                        if (tmdbId !== routeId) {
                            suppressRouteReload.value = true;
                            await router.replace(
                                paths.streamAnime(tmdbId, currentEpisode.value, anilistIdRef.value)
                            );
                        }
                        await loadTmdbArtworkByTmdbId(tmdbId, generation);
                        if (generation !== loadGeneration) return;
                    }
                }

                let show = await fetchTmdbAnimeShowDetails(tmdbId);
                if (generation !== loadGeneration) return;

                // If TMDB lookup failed and we have an AniList ID (from ?ani=), resolve TMDB ID from it
                if (!tmdbArtwork.value?.tmdbId && !show && anilistIdRef.value && anilistIdRef.value !== routeId) {
                    const anilistRes = await fetchAnimeById(anilistIdRef.value).catch(() => null);
                    const anilistMedia = anilistRes?.data?.Media;
                    if (anilistMedia) {
                        const meta = await resolveAnimeTmdbMeta(anilistIdRef.value, anilistMedia, { deferFranchise: true });
                        const correctTmdbId = meta?.tmdbId;
                        if (correctTmdbId && correctTmdbId !== tmdbId) {
                            tmdbId = correctTmdbId;
                            animeId.value = tmdbId;
                            suppressRouteReload.value = true;
                            await router.replace(paths.streamAnime(tmdbId, currentEpisode.value, anilistIdRef.value));
                            if (generation !== loadGeneration) return;
                            await loadTmdbArtworkByTmdbId(tmdbId, generation);
                            if (generation !== loadGeneration) return;
                        }
                    }
                    show = await fetchTmdbAnimeShowDetails(tmdbId);
                }

                if (show) {
                    tmdbShow.value = show;
                } else if (tmdbArtwork.value) {
                    tmdbShow.value = {
                        id: tmdbId,
                        name: `Anime #${tmdbId}`,
                        poster_path: tmdbArtwork.value.posterPath,
                        backdrop_path: tmdbArtwork.value.backdropPath,
                        number_of_episodes: tmdbArtwork.value.totalEpisodeCount
                    };
                }

                if (anilistIdRef.value) {
                    loadAnilistPlaybackMeta(anilistIdRef.value);
                }

                const posterPath = tmdbArtwork.value?.posterPath || show?.poster_path;
                addViewedItem({
                    id: tmdbId,
                    title: animeTitle.value || `Anime #${tmdbId}`,
                    image: posterPath ? useWebImage(posterPath, 'medium') : '',
                    rating: show?.vote_average ?? 0,
                    categories: [],
                    adult: false,
                    type: 'anime'
                });
            } catch (err) {
                console.error('Failed to load anime for streaming:', err);
            }
        };

        const goBack = () => {
            router.push(paths.anime(animeId.value));
        };

        const handleWatchTogether = (event: MouseEvent) => {
            isNavigatingToParty.value = true;
            const target = event.currentTarget as HTMLAnchorElement;
            const href = target.href;
            setTimeout(() => {
                window.location.href = href;
            }, 50);
        };

        const changeEpisode = (ep: number) => {
            if (ep < 1 || ep === currentEpisode.value) return;
            syncSeasonTabForEpisode(ep);
            currentEpisode.value = ep;
            router.push(paths.streamAnime(animeId.value, ep, anilistIdRef.value));
        };

        const onMobileEpisodeSelect = async (ep: number, selectedSeasonNum: number) => {
            if (navigatorSeason.value !== selectedSeasonNum) {
                activeTmdbSeason.value = selectedSeasonNum;
                currentEpisode.value = ep;
                syncSeasonTabForEpisode(ep);
                await loadSeason();
                router.replace(paths.streamAnime(animeId.value, ep, anilistIdRef.value));
            } else {
                changeEpisode(ep);
            }
        };

        const goToEpisode = (ep: number) => changeEpisode(ep);

        const isLastEpisode = computed(() => {
            const now = new Date();
            const releasedCount = seasonEpisodes.value.filter((ep) => {
                if (!ep.air_date) return true;
                return new Date(ep.air_date) <= now;
            }).length;
            const lastInSeason = currentEpisode.value === releasedCount;
            const lastSeason = !nextSeasonNumber.value;
            return lastInSeason && lastSeason;
        });

        const goToPreviousEpisode = async () => {
            const eps = seasonEpisodes.value;
            const idx = eps.findIndex((e) => e.episode_number === currentEpisode.value);
            if (idx > 0) {
                goToEpisode(eps[idx - 1].episode_number);
                return;
            }
            if (usesTmdbSeasonTabs.value && navigatorSeason.value > 1) {
                const prevSeasonNum = navigatorSeason.value - 1;
                activeTmdbSeason.value = prevSeasonNum;
                currentEpisode.value = 1;
                await loadSeason();
                const now = new Date();
                const releasedCount = seasonEpisodes.value.filter((ep) => {
                    if (!ep.air_date) return true;
                    return new Date(ep.air_date) <= now;
                }).length;
                if (releasedCount > 0) {
                    goToEpisode(seasonEpisodes.value[releasedCount - 1].episode_number);
                }
                return;
            }
            if (currentEpisode.value > seasonFirstEpisode.value) {
                goToEpisode(currentEpisode.value - 1);
            }
        };

        const goToNextEpisode = () => {
            if (isLastEpisode.value) return;
            const now = new Date();
            const releasedCount = seasonEpisodes.value.filter((ep) => {
                if (!ep.air_date) return true;
                return new Date(ep.air_date) <= now;
            }).length;
            const idx = seasonEpisodes.value.findIndex((e) => e.episode_number === currentEpisode.value);
            if (idx >= 0 && idx < releasedCount - 1) {
                goToEpisode(seasonEpisodes.value[idx + 1].episode_number);
            } else if (nextSeasonNumber.value) {
                onSeasonChange(nextSeasonNumber.value).then(() => goToEpisode(
                    seasonEpisodes.value[0]?.episode_number ?? 1
                ));
            } else if (currentEpisode.value < releasedCount) {
                goToEpisode(currentEpisode.value + 1);
            }
        };

        const currentSeasonIdx = computed(() => {
            if (!seasonsList.value.length) return -1;
            return seasonsList.value.findIndex((s) => s.id === activeTmdbSeason.value);
        });

        const currentSeasonNumber = computed(() => {
            return currentSeasonIdx.value !== -1 ? currentSeasonIdx.value + 1 : 1;
        });

        const nextSeasonId = computed(() => {
            const idx = currentSeasonIdx.value;
            if (idx === -1 || idx + 1 >= seasonsList.value.length) return null;
            return seasonsList.value[idx + 1].id;
        });

        const nextSeasonNumber = computed(() => nextSeasonId.value ?? 0);

        const nextSeasonCoverImage = ref<string>('');
        const nextSeasonTitle = ref<string>('');

        watch(nextSeasonId, (id) => {
            if (!id) {
                nextSeasonCoverImage.value = '';
                nextSeasonTitle.value = '';
                return;
            }

            const tab = tmdbArtwork.value?.seasonTabs.find((s) => s.seasonNumber === id);
            nextSeasonTitle.value = tab?.label ?? '';
            nextSeasonCoverImage.value = tmdbPosterPath.value;
        }, { immediate: true });

        const mapBrowsableToEpisodes = (
            eps: EpisodeLike[],
            seasonNumber: number,
            fallbackStillPath: string,
            fallbackDesc: string
        ): Episode[] => {
            return eps.map((ep) => {
                const tmdbEp = ep as AnimeTmdbEpisode;
                return {
                    ...ep,
                    id: ep.episode_number,
                    name: ep.name || `Episode ${ep.episode_number}`,
                    overview: tmdbEp.overview || fallbackDesc,
                    still_path: tmdbEp.still_path || fallbackStillPath || '',
                    air_date: ep.air_date || '',
                    episode_number: ep.episode_number,
                    season_number: tmdbEp.season_number ?? seasonNumber,
                    crew: [],
                    guest_stars: [],
                    production_code: '',
                    runtime: 0,
                    vote_average: 0,
                    vote_count: 0
                };
            }) as unknown as Episode[];
        };

        const episodesForTmdbTab = (seasonNumber: number) => {
            const all = browsableTmdbEpisodes.value;
            if (!all.length) return [];

            const tab = tmdbArtwork.value?.seasonTabs.find((s) => s.seasonNumber === seasonNumber);
            if (tab) {
                const byRange = all.filter(
                    (ep) => ep.episode_number >= tab.firstEpisode && ep.episode_number <= tab.lastEpisode
                );
                if (byRange.length) return byRange;
            }

            return all.filter(
                (ep) => (ep as AnimeTmdbEpisode).season_number === seasonNumber
            );
        };

        const resolveRawSeasonEpisodes = (): EpisodeLike[] => {
            const all = browsableTmdbEpisodes.value;
            if (!all.length) {
                const count = Math.max(globalMaxEpisode.value, currentEpisode.value);
                const dummyList: EpisodeLike[] = [];
                for (let i = 1; i <= count; i++) {
                    dummyList.push({
                        episode_number: i,
                        name: `Episode ${i}`,
                        air_date: ''
                    });
                }
                return dummyList;
            }

            if (!usesTmdbSeasonTabs.value) return all;

            const forActiveSeason = episodesForTmdbTab(activeTmdbSeason.value);
            if (forActiveSeason.length) return forActiveSeason;

            const tab = findTmdbSeasonTabForEpisode(
                currentEpisode.value,
                tmdbArtwork.value?.seasonTabs ?? []
            );
            if (tab) {
                return all.filter(
                    (ep) => ep.episode_number >= tab.firstEpisode && ep.episode_number <= tab.lastEpisode
                );
            }

            return all;
        };

        const buildSeasonEpisodeList = (
            raw: EpisodeLike[],
            seasonNumber: number,
            fallbackImg: string,
            fallbackDesc: string
        ): { list: Episode[]; nextAiring: Episode | null } => {
            const mapped = mapBrowsableToEpisodes(raw, seasonNumber, fallbackImg, fallbackDesc);
            const { list, nextAiring } = partitionStreamSeasonEpisodes(mapped);
            return { list: list as Episode[], nextAiring: nextAiring as Episode | null };
        };

        const loadSeason = async () => {
            const raw = resolveRawSeasonEpisodes();
            if (!raw.length) {
                seasonEpisodes.value = [];
                nextAiringEpisode.value = null;
                return;
            }

            isLoadingEpisodes.value = true;
            try {
                const fallbackStillPath =
                    tmdbArtwork.value?.posterPath || tmdbArtwork.value?.backdropPath || '';
                const desc = tmdbShow.value?.overview || '';
                const current = buildSeasonEpisodeList(
                    raw,
                    navigatorSeason.value,
                    fallbackStillPath,
                    desc
                );
                seasonEpisodes.value = current.list;
                nextAiringEpisode.value = current.nextAiring;

                if (nextSeasonId.value) {
                    const nextRaw = episodesForTmdbTab(nextSeasonId.value);
                    if (nextRaw.length) {
                        const next = buildSeasonEpisodeList(
                            nextRaw,
                            nextSeasonNumber.value,
                            fallbackStillPath,
                            ''
                        );
                        nextSeasonEpisodes.value = next.list;
                    } else {
                        nextSeasonEpisodes.value = [];
                    }
                } else {
                    nextSeasonEpisodes.value = [];
                }
            } catch (err) {
                console.error('Failed to load anime season:', err);
            } finally {
                isLoadingEpisodes.value = false;
            }
        };

        const onUpNextSelect = async (payload: { season: number; episode: number }) => {
            if (payload.season !== navigatorSeason.value) {
                activeTmdbSeason.value = payload.season;
                currentEpisode.value = payload.episode;
                syncSeasonTabForEpisode(payload.episode);
                await loadSeason();
                router.push(paths.streamAnime(animeId.value, payload.episode, anilistIdRef.value));
            } else {
                changeEpisode(payload.episode);
            }
        };

        const onUpNextSeasonChange = (next: number) => {
            if (next !== navigatorSeason.value) {
                onSeasonChange(next);
            }
        };

        // Keyboard navigation for step increment
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            // Only change episode with Ctrl+Arrow, let plain arrows seek in video
            if (e.key === 'ArrowLeft' && e.ctrlKey) {
                e.preventDefault();
                if (currentEpisode.value > 1) {
                    goToEpisode(currentEpisode.value - 1);
                }
            } else if (e.key === 'ArrowRight' && e.ctrlKey) {
                e.preventDefault();
                if (currentEpisode.value < seasonLastEpisode.value) {
                    goToEpisode(currentEpisode.value + 1);
                }
            }
        };

        // Real-time message listener for auto-next and watch progress saving
        const handlePlayerMessage = (event: MessageEvent) => {
            let data = event.data;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    return;
                }
            }
            if (!data) return;

            // Handle Videasy progress tracking
            if (data.timestamp !== undefined && data.duration !== undefined) {
                saveProgress(animeId.value, 'anime', Number(data.timestamp), Number(data.duration), undefined, currentEpisode.value);
            }

            // Sync current episode from player if it auto-advances
            if (data.episode !== undefined && Number(data.episode) !== currentEpisode.value) {
                goToEpisode(Number(data.episode));
            }

            // Handle watch progress saving
            if (data.event === 'time' && data.time !== undefined && data.duration !== undefined) {
                saveProgress(animeId.value, 'anime', data.time, data.duration, undefined, currentEpisode.value);
            } else if (data.type === 'watching-log' && data.currentTime !== undefined && data.duration !== undefined) {
                saveProgress(animeId.value, 'anime', data.currentTime, data.duration, undefined, currentEpisode.value);
            }

            // Handle auto-next
            if (data.event === 'complete') {
                const nextEp = currentEpisode.value + 1;
                if (nextEp <= seasonLastEpisode.value) {
                    goToEpisode(nextEp);
                }
            }
        };

        const previewEpisodes = ref<Episode[]>([]);
        const isPreviewLoading = ref(false);

        const onPreviewSeason = async (seasonNum: number) => {
            if (seasonNum === navigatorSeason.value) {
                previewEpisodes.value = [];
                return;
            }
            isPreviewLoading.value = true;
            try {
                const raw = episodesForTmdbTab(seasonNum);
                if (raw.length) {
                    const preview = buildSeasonEpisodeList(
                        raw,
                        seasonNum,
                        tmdbPosterPath.value,
                        tmdbShow.value?.overview || ''
                    );
                    previewEpisodes.value = preview.list;
                } else {
                    previewEpisodes.value = [];
                }
            } catch (err) {
                console.error('Failed to load anime season preview:', err);
            } finally {
                isPreviewLoading.value = false;
            }
        };

        onMounted(() => {
            const epParam = route.params.episode;
            if (epParam) {
                currentEpisode.value = parseInt(epParam as string) || 1;
            }
            loadAnime(animeId.value);
            window.addEventListener('message', handlePlayerMessage);
            window.addEventListener('keydown', handleKeyDown);
            document.addEventListener('fullscreenchange', onFullscreenChange);
            showControls();
        });

        onUnmounted(() => {
            window.removeEventListener('message', handlePlayerMessage);
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
        });

        watch(
            () => route.params.id,
            (id) => {
                if (suppressRouteReload.value) {
                    suppressRouteReload.value = false;
                    return;
                }
                const parsed = Number(id);
                if (!parsed || parsed === animeId.value) return;
                animeId.value = parsed;
                loadAnime(parsed);
            }
        );

        watch(
            () => route.params.episode,
            (newEp) => {
                if (!newEp) return;
                const ep = parseInt(newEp as string) || 1;
                const maxEp = globalMaxEpisode.value;
                const resolved = ep > maxEp && maxEp > 0 ? maxEp : ep;
                syncSeasonTabForEpisode(resolved);
                currentEpisode.value = resolved;
                if (resolved !== ep && maxEp > 0) {
                    router.replace(paths.streamAnime(animeId.value, resolved, anilistIdRef.value));
                }
            }
        );

        watch(tmdbArtwork, () => {
            syncSeasonTabForEpisode(currentEpisode.value);
        });

        const upNextDrawerRef = ref<any>(null);

        const openEpisodePicker = () => {
            if (upNextDrawerRef.value) {
                upNextDrawerRef.value.open = true;
            }
        };

        const inWatchlist = computed(() => {
            if (!animeId.value) return false;
            return isInWatchlist(animeId.value, 'anime');
        });

        const toggleWatchlist = () => {
            if (!animeId.value || !animeTitle.value) return;
            const item: WatchlistItem = {
                id: animeId.value,
                title: animeTitle.value,
                image: tmdbPosterPath.value || tmdbBackdropPath.value || null,
                rating: 0,
                categories: [],
                adult: false,
                type: 'anime'
            };
            toggleWatchlistItem(item);
        };

        return {
            animeId,
            activeTmdbSeason,
            totalEpisodes,
            resolvedAnilistId,
            tmdbShow,
            animeTitle,
            currentEpisode,
            seasonFirstEpisode,
            seasonLastEpisode,
            activeSeasonSelectValue,
            tmdbPosterPath,
            tmdbBackdropPath,
            activeServerIndex,
            availableServers,
            frameRef,
            onServerChange,
            changeLanguage,
            onEmbedChange,
            embedActive,
            isAnimeplayServer,
            currentEmbedUrl,
            partyHref,
            seasonsList,
            goToSeason,
            activeLanguage,
            availableSeasons,
            navigatorSeason,
            onSeasonChange,
            goToPreviousEpisode,
            goToNextEpisode,
            currentSeasonNumber,
            seasonEpisodes,
            nextSeasonNumber,
            nextSeasonEpisodes,
            nextAiringInfo,
            isLastEpisode,
            onUpNextSelect,
            onUpNextSeasonChange,
            goBack,
            handleWatchTogether,
            changeEpisode,
            onMobileEpisodeSelect,
            goToEpisode,
            getEpisodeInSeasonNumber,
            isLoadingTmdb,
            isLoadingEpisodes,
            seasonsDropdownList,
            previewEpisodes,
            isPreviewLoading,
            onPreviewSeason,
            upNextDrawerRef,
            openEpisodePicker,
            useWebImage,
            isEmbed,
            controlsVisible,
            showControls,
            scheduleHide,
            inWatchlist,
            toggleWatchlist,
            isFullscreen,
            toggleFullscreen,
            anilistIdRef
        };
    }
});
</script>

<style lang="scss" scoped src="@/assets/css/stream-anime.scss"></style>
