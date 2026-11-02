<template>
    <MobileShell>
        <section class="m-home__hero" :class="{ 'is-loading': !hero }">
            <div v-if="!hero" class="m-home__hero-skeleton m-home__hero-skeleton-shimmer" />
            <router-link v-else :to="movie(hero.id)" class="m-home__hero-link">
                <img
                    v-if="heroBackdrop"
                    :src="heroBackdrop"
                    :alt="hero.title"
                    class="m-home__hero-img"
                    fetchpriority="high"
                />
                <div class="m-home__hero-scrim" aria-hidden="true" />
                <div class="m-home__hero-body">
                    <p class="eyebrow m-home__hero-eyebrow">Featured</p>
                    <h1 class="m-home__hero-title">{{ hero.title }}</h1>
                    <p v-if="hero.overview" class="m-home__hero-desc">{{ heroOverview }}</p>
                    <div class="m-home__hero-actions">
                        <span class="m-home__hero-cta" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            Watch now
                        </span>
                    </div>
                </div>
            </router-link>
        </section>

        <!-- Download Quality Panel -->
        <Teleport to="body">
            <Transition name="lm-dialog">
                <div
                    v-if="showDownloadModal"
                    class="m-home__dl-overlay"
                    @click.self="showDownloadModal = false"
                >
                    <div class="m-home__dl-modal" role="dialog" aria-modal="true">
                        <header class="m-home__dl-header">
                            <h3 class="m-home__dl-title">Download</h3>
                            <button type="button" class="m-home__dl-close" @click="showDownloadModal = false">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            </button>
                        </header>
                        <div class="m-home__dl-body">
                            <button
                                v-for="opt in downloadOptions"
                                :key="opt.url"
                                type="button"
                                class="m-home__dl-opt"
                                @click="triggerDownload(opt.url, opt.quality)"
                            >
                                <span
                                    class="m-home__dl-badge"
                                    :class="{
                                        'is-4k': opt.quality.includes('4K') || opt.quality.includes('2160'),
                                        'is-1080': opt.quality.includes('1080'),
                                        'is-720': opt.quality.includes('720')
                                    }"
                                >{{ opt.quality }}</span>
                                <span class="m-home__dl-meta">
                                    <span class="m-home__dl-chip">MP4</span>
                                    <template v-if="opt.size === ''">
                                        <span class="m-home__dl-dot">•</span>
                                        <span class="m-home__dl-size is-checking">Checking...</span>
                                    </template>
                                    <template v-else-if="opt.size && opt.size !== '-'">
                                        <span class="m-home__dl-dot">•</span>
                                        <span class="m-home__dl-size">{{ opt.size }}</span>
                                    </template>
                                </span>
                                <svg class="m-home__dl-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <MobileSection
            title="Trending Top 10"
            eyebrow="Popular Today"
            :more-to="{ name: 'Movies' }"
            class="m-home__section"
        >
            <MobileMediaRail :items="trendingItems" />
        </MobileSection>

        <MobileContinueShelf class="m-home__continue" />

        <SpotlightModule
            v-if="spotlight"
            class="m-home__section"
            :id="spotlight.id"
            type="movie"
            :title="spotlight.title"
            :overview="spotlight.overview"
            :backdrop-path="spotlight.backdrop_path"
            :poster-path="spotlight.poster_path"
            :rating="spotlight.vote_average"
            :release-date="spotlight.release_date"
            eyebrow="The Feature"
            :pull-quote="spotlightQuote"
            attribution="Movieace Review"
        />

        <MobileSection
            title="The Pantheon"
            eyebrow="Reader Favorites"
            :more-to="{ name: 'Movies' }"
            class="m-home__section"
        >
            <MobileMediaRail :items="pantheonItems" />
        </MobileSection>
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import MobileContinueShelf from '../components/MobileContinueShelf.vue';
import { useHighlights, highLightOptions } from '@/composables/useHighlights';
import { logDownload } from '@/composables/useDownloadTracking';
import { primeGenres } from '@/composables/useGenreLookup';
import { useAppPaths } from '@/composables/useAppPaths';
import { useWebImage } from '@/utils/useWebImage';
import SpotlightModule from '@/components/hero/SpotlightModule.vue';
import MobileSection from '../components/MobileSection.vue';
import MobileMediaRail from '../components/MobileMediaRail.vue';
const { movie } = useAppPaths();
const { fetchAllHighlights } = useHighlights();

const pantheonItems = computed(() =>
    (highLightOptions.popular.data ?? []).slice(10, 28).map(m => ({
        id: m.id,
        type: 'movie' as const,
        title: m.title,
        posterPath: m.poster_path,
        rating: m.vote_average,
        releaseDate: m.release_date,
        genreIds: m.genre_ids,
        adult: m.adult
    }))
);

const trendingItems = computed(() =>
    (highLightOptions.featured.data ?? []).slice(0, 10).map(m => ({
        id: m.id,
        type: 'movie' as const,
        title: m.title,
        posterPath: m.poster_path,
        rating: m.vote_average,
        releaseDate: m.release_date,
        genreIds: m.genre_ids,
        adult: m.adult
    }))
);

const spotlight = computed(() => {
    const pool = highLightOptions.featured.data ?? [];
    return pool[1] ?? pool[0] ?? null;
});

const spotlightQuote = computed(() => {
    const overview = spotlight.value?.overview ?? '';
    if (!overview) return '';
    const firstSentence = overview.split(/(?<=[.!?])\s/)[0] ?? overview;
    return firstSentence.length > 220
        ? `${firstSentence.slice(0, 217).trim()}…`
        : firstSentence;
});

const hero = computed(() => highLightOptions.featured.data?.[0] ?? null);

const heroBackdrop = computed(() => {
    const path = hero.value?.backdrop_path || hero.value?.poster_path;
    return path ? useWebImage(path, 'large') : '';
});

const heroOverview = computed(() => {
    const text = hero.value?.overview ?? '';
    return text.length > 140 ? `${text.slice(0, 137).trim()}…` : text;
});

const loadData = async () => {
    highLightOptions.featured.data = [];
    highLightOptions.popular.data = [];
    highLightOptions.new.data = [];

    await fetchAllHighlights();
};

const showDownloadModal = ref(false);
const downloadOptions = ref<{ quality: string; url: string; size?: string }[]>([]);

watch(showDownloadModal, (v) => {
    document.body.style.overflow = v ? 'hidden' : '';
});

const extractDirectDownloadUrl = (rawUrl: string): string => {
    if (!rawUrl) return '';
    try {
        const fullUrl = rawUrl.startsWith('/') ? `https://watchable-virid.vercel.app${rawUrl}` : rawUrl;
        const u = new URL(fullUrl);
        const embedded = u.searchParams.get('link') || u.searchParams.get('url') || u.searchParams.get('file') || u.searchParams.get('download');
        if (embedded && /^https?:\/\//i.test(embedded)) return embedded;
        return fullUrl;
    } catch (e) {
        return rawUrl.startsWith('/') ? `https://watchable-virid.vercel.app${rawUrl}` : rawUrl;
    }
};

const triggerDownload = (url: string, quality: string) => {
    const finalUrl = extractDirectDownloadUrl(url);
    const h = hero.value;
    const titleClean = (h?.title || 'media').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const isCrossOrigin = (() => { try { return new URL(finalUrl).origin !== location.origin } catch { return true } })();
    if (!isCrossOrigin) {
        const a = document.createElement('a');
        a.href = finalUrl;
        a.download = `${titleClean}_${quality}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } else {
        window.open(finalUrl, '_blank');
    }
    showDownloadModal.value = false;
    logDownload(h.id, 'movie', quality, h.title);
};

const handleSettingsChange = () => {
    loadData();
};

onMounted(() => {
    document.title = 'Moovie';
    primeGenres();
    loadData();
    window.addEventListener('movora_settings_change', handleSettingsChange);
});

onBeforeUnmount(() => {
    window.removeEventListener('movora_settings_change', handleSettingsChange);
});
</script>

<style lang="scss" scoped>
.m-home {
    &__hero {
        margin: var(--s-3) var(--s-4) var(--s-4);
        border-radius: var(--r-md);
        overflow: hidden;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    }

    &__hero-skeleton {
        width: 100%;
        aspect-ratio: 16 / 10;
        background: var(--ink-800);
    }

    &__hero-skeleton-shimmer {
        position: relative;
        overflow: hidden;

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
            animation: mobile-hero-shimmer 1.6s infinite ease-in-out;
        }
    }

    &__hero-link {
        position: relative;
        display: block;
        aspect-ratio: 16 / 10;
        color: inherit;
        text-decoration: none;
    }

    &__hero-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: blur(0.5px);
    }

    &__hero-scrim {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, transparent 20%, rgba(11, 10, 8, 0.92) 100%);
    }

    &__hero-body {
        position: absolute;
        inset: auto 0 0 0;
        padding: var(--s-4);
    }

    &__hero-eyebrow {
        color: var(--ember);
        margin-bottom: var(--s-1);
    }

    &__hero-title {
        font-family: var(--font-display);
        font-size: clamp(1.4rem, 5vw, 1.75rem);
        font-weight: 500;
        line-height: 1.1;
        margin: 0 0 var(--s-2);
    }

    &__hero-desc {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--bone-300);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    &__hero-cta {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.45rem 0.85rem;
        border-radius: var(--r-pill);
        background: var(--ember);
        color: var(--ink-900);
        font-family: var(--font-ui);
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.02em;
    }

    &__hero-actions {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        margin-top: var(--s-3);
    }

    &__hero-dl {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.45rem 0.85rem;
        border-radius: var(--r-pill);
        background: rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(4px);
        color: var(--bone-100);
        font-family: var(--font-ui);
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: background 0.15s;

        &:hover {
            background: rgba(255, 255, 255, 0.22);
        }
    }

    &__continue {
        margin: 0 var(--s-4) var(--s-2);
    }

    &__section {
        margin: var(--s-4) var(--s-4) var(--s-4);
        
        :deep(.spotlight__grid) {
            grid-template-columns: minmax(0, 1fr) !important;
        }
    }

    &__dl-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(4, 5, 8, 0.84);
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 0;
    }

    &__dl-modal {
        position: relative;
        background: linear-gradient(165deg, rgba(20, 22, 30, 0.96) 0%, rgba(10, 11, 16, 0.98) 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 20px 20px 0 0;
        width: 100%;
        max-height: 60vh;
        display: flex;
        flex-direction: column;
        padding: 16px;
        box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.6);

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

    &__dl-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    &__dl-title {
        font-size: 1rem;
        font-weight: 700;
        color: var(--bone-50);
        margin: 0;
    }

    &__dl-close {
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

    &__dl-body {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;

        &::-webkit-scrollbar { width: 4px; }
        &::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 4px; }
        &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18); border-radius: 4px; }
    }

    &__dl-opt {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 12px;
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

    &__dl-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-mono, monospace);
        font-size: 0.7rem;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.08);
        color: #e2e2e8;
        border: 1px solid rgba(255, 255, 255, 0.12);
        flex-shrink: 0;
        min-width: 42px;

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

    &__dl-meta {
        flex: 1;
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.5);
    }

    &__dl-chip {
        font-family: var(--font-mono, monospace);
        font-size: 0.65rem;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.7);
        padding: 1px 5px;
        border-radius: 4px;
    }

    &__dl-dot {
        color: rgba(255, 255, 255, 0.25);
        flex-shrink: 0;
    }

    &__dl-size {
        color: #ff9d54;
        font-weight: 700;
        font-size: 0.65rem;
        background: rgba(255, 107, 0, 0.14);
        border: 1px solid rgba(255, 107, 0, 0.25);
        padding: 1px 5px;
        border-radius: 4px;
        &.is-checking {
            color: rgba(255, 255, 255, 0.5);
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.1);
            font-style: italic;
        }
    }

    &__dl-arrow {
        flex-shrink: 0;
        color: rgba(255, 255, 255, 0.4);
        transition: color 0.2s, transform 0.2s;
    }

    &__dl-opt:hover &__dl-arrow {
        color: #ff6b00;
        transform: translateY(2px);
    }
}

@keyframes mobile-hero-shimmer {
    100% {
        transform: translateX(100%);
    }
}
</style>
