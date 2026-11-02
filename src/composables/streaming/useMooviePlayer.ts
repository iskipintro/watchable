import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useStreamExtension } from '@/composables/streaming/useStreamExtension';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

export type PlayerSkin = 'default' | 'netflix';

export interface MoovieStream {
    quality: string;
    url: string;
}

export interface MoovieResolve {
    meta: {
        id: string;
        title: string;
        subjectid: string;
        media_type: string;
        backdrop_path: string | null;
    };
    streams: MoovieStream[];
    playerProxyUrl: string;
    streamWarning?: string | null;
    resolveType?: string;
    resolveSeason?: number;
    resolveEpisode?: number;
}

function titleSuggestsAnime(title: string) {
    const t = title.toLowerCase();
    return /\banime\b|kimetsu|naruto|one piece|demon slayer|gachiakuta|jujutsu|solo leveling|dragon ball|bleach\b|hunter x hunter|attack on titan/.test(
        t
    );
}

export function streamsLookCorrupt(title: string, streams: MoovieStream[]) {
    if (!streams.length) return false;
    const allAnimeCdn = streams.every((s) => /\/animekai\//i.test(s.url));
    if (!allAnimeCdn) return false;
    return !titleSuggestsAnime(title);
}

/** Prefer mid-quality mp4 for first paint — 1080P URLs expire or 403 more often. */
const defaultQualityPreference: Record<string, number> = {
    '720P': 4,
    '480P': 3,
    '1080P': 2,
    '360P': 1,
    unknown: 0
};

function streamFormatScore(url: string) {
    const lower = String(url || '').toLowerCase();
    if (lower.includes('.mp4')) return 2;
    if (lower.includes('.mkv')) return 1;
    return 0;
}

function detectStreamMediaType(url: string) {
    const path = String(url || '').split('?')[0].toLowerCase();
    if (path.endsWith('.mkv')) return 'mkv';
    if (path.endsWith('.mp4')) return 'mp4';
    return 'mp4';
}

function scoreStreamForDefault(stream: MoovieStream) {
    return (
        streamFormatScore(stream.url) * 100 +
        (defaultQualityPreference[stream.quality] ?? 0)
    );
}

function findNextFallbackStreamIndex(
    streams: MoovieStream[],
    failed: Set<number>,
    currentIndex: number
) {
    const fallbackOrder = ['480P', '360P', '720P', '1080P', 'unknown'];
    for (const quality of fallbackOrder) {
        const idx = streams.findIndex(
            (stream, i) => !failed.has(i) && i !== currentIndex && stream.quality === quality
        );
        if (idx >= 0) return idx;
    }

    for (let i = 0; i < streams.length; i++) {
        if (!failed.has(i) && i !== currentIndex) return i;
    }
    return -1;
}

function streamUrlAgeSec(rawUrl: string) {
    try {
        const t = Number(new URL(rawUrl).searchParams.get('t') || '0');
        if (!t) return null;
        return Math.max(0, Math.floor(Date.now() / 1000 - t));
    } catch {
        return null;
    }
}

function withPlaybackCacheBuster(absUrl: string) {
    const sep = absUrl.includes('?') ? '&' : '?';
    return `${absUrl}${sep}_cb=${Date.now()}`;
}

async function parseApiResponse(resp: Response) {
    const text = await resp.text();
    const looksLikeHtml =
        text.trimStart().startsWith('<') || /<!doctype/i.test(text.slice(0, 200));
    if (looksLikeHtml) {
        throw new Error(
            'API returned HTML instead of JSON. Deploy /api/moovie-catalog or run npm run dev locally.'
        );
    }
    return JSON.parse(text);
}

const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000;
const resolveCache = new Map<string, { data: MoovieResolve; at: number }>();
const resolveInFlight = new Map<string, Promise<MoovieResolve>>();

export function buildMoovieResolveUrl(opts: {
    type: 'movie' | 'tv';
    id: string;
    season?: number;
    episode?: number;
    server?: number;
}) {
    const params = new URLSearchParams({
        action: 'resolve',
        type: opts.type,
        id: opts.id,
        se: String(opts.season ?? 0),
        ep: String(opts.episode ?? 0),
        server: String(opts.server ?? 1)
    });
    return `/api/moovie-catalog?${params.toString()}`;
}

const loadHlsJs = (() => {
    let promise: Promise<void> | null = null;
    return () => {
        if ((window as any).Hls) return Promise.resolve();
        if (promise) return promise;
        promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('hls.js failed to load'));
            document.head.appendChild(script);
        });
        return promise;
    };
})();

/** Warm player assets before the user hits play: preload hls.js and open a
 *  connection to the hub so the manifest/segment fetches start instantly. */
let assetsWarmed = false;
export function warmMooviePlayerAssets() {
    if (assetsWarmed) return Promise.resolve();
    assetsWarmed = true;
    try {
        const hints = document.createElement('link');
        hints.rel = 'preconnect';
        hints.href = 'https://watchable-virid.vercel.app';
        document.head.appendChild(hints);
    } catch {}
    return loadHlsJs().catch(() => {});
}

async function fetchMoovieResolve(url: string): Promise<MoovieResolve> {
    const cached = resolveCache.get(url);
    if (cached && Date.now() - cached.at < RESOLVE_CACHE_TTL_MS) {
        return cached.data;
    }

    const pending = resolveInFlight.get(url);
    if (pending) return pending;

    const task = (async () => {
        const resp = await fetch(url);
        const data = await parseApiResponse(resp);
        if (!resp.ok) throw new Error(data.error || `Resolve failed (${resp.status})`);
        const resolved = data as MoovieResolve;
        resolveCache.set(url, { data: resolved, at: Date.now() });
        return resolved;
    })();

    resolveInFlight.set(url, task);
    try {
        return await task;
    } finally {
        resolveInFlight.delete(url);
    }
}

/** Prefetch stream resolve in the background (hover / detail page). */
export function prefetchMoovieResolve(opts: {
    type: 'movie' | 'tv';
    id: string;
    season?: number;
    episode?: number;
    server?: number;
}) {
    const id = String(opts.id || '').trim();
    if (!id) return;

    const url = buildMoovieResolveUrl({
        type: opts.type,
        id,
        season: opts.season ?? (opts.type === 'tv' ? 1 : 0),
        episode: opts.episode ?? (opts.type === 'tv' ? 1 : 0),
        server: opts.server
    });

    const cached = resolveCache.get(url);
    if (cached && Date.now() - cached.at < RESOLVE_CACHE_TTL_MS) return;
    if (resolveInFlight.has(url)) return;

    void fetchMoovieResolve(url).catch(() => {
        /* prefetch is best-effort */
    });
}

export interface PlaybackResumeOptions {
    resumeAt?: number;
    resumePlaying?: boolean;
}

export function formatPlayerTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function useMooviePlayer(options: { skin?: PlayerSkin } = {}) {
    const skin = options.skin ?? 'default';
    const dbg = (step: string, detail?: unknown) => {
        if (skin === 'netflix') console.log(step, detail);
    };
    const dbgError = (step: string, detail?: unknown) => {
        if (skin === 'netflix') console.error(step, detail);
    };
    const { extensionActive, checkExtension, pingExtension } = useStreamExtension();
    const loading = ref(false);
    const playbackError = ref('');
    const streamWarning = ref('');
    const resolved = ref<MoovieResolve | null>(null);
    const selectedStreamIndex = ref(0);
    const artReady = ref(false); // rename to plyrReady conceptually but keep property name
    const artContainer = ref<HTMLElement | null>(null); // rename to playerContainer conceptually but keep property name
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const buffered = ref(0);
    const isMuted = ref(false);
    const playbackEnded = ref(false);

    let plyrInstance: Plyr | null = null;
    let hlsInstance: any = null;
    let prepareToken = 0;
    let resolveToken = 0;
    let playbackRetryToken = 0;
    let playbackErrorRetries = 0;
    let refreshInFlight: Promise<MoovieResolve | null> | null = null;
    let activeResolveUrl = '';
    const failedStreamIndices = new Set<number>();

    class ResolveAborted extends Error {
        override name = 'ResolveAborted';
    }

    const isResolveActive = (token: number) => token === resolveToken;
    let videoClickHandler: ((event: MouseEvent) => void) | null = null;

    const clearArtInstance = () => {
        const video = (plyrInstance as any)?.media as HTMLVideoElement | undefined;
        if (video && videoClickHandler) {
            video.removeEventListener('click', videoClickHandler);
            videoClickHandler = null;
        }
        if (video) {
            try {
                video.pause();
                video.removeAttribute('src');
                video.load();
            } catch {
                /* ignore */
            }
        }
        if (plyrInstance) {
            dbg('player:destroy');
            try {
                plyrInstance.destroy();
            } catch {
                /* ignore */
            }
            plyrInstance = null;
        }
        if (hlsInstance) {
            try {
                hlsInstance.destroy();
            } catch {
                /* ignore */
            }
            hlsInstance = null;
        }
        if (artContainer.value) {
            artContainer.value.innerHTML = '';
        }
        artReady.value = false;
        isPlaying.value = false;
        currentTime.value = 0;
        duration.value = 0;
        buffered.value = 0;
        playbackEnded.value = false;
    };

    const destroyArt = () => {
        prepareToken++;
        clearArtInstance();
        loading.value = false;
    };

    const resetPlaybackSession = () => {
        resolveToken++;
        prepareToken++;
        playbackRetryToken++;
        playbackErrorRetries = 0;
        failedStreamIndices.clear();
        activeResolveUrl = '';
        playbackError.value = '';
        streamWarning.value = '';
        resolved.value = null;
        destroyArt();
    };

    /** Single resolve round-trip — used when the player is already mounted (episode/audio switch). */
    const fetchResolveQuick = async (
        opts: {
            type: 'movie' | 'tv';
            id: string;
            season?: number;
            episode?: number;
            server?: number;
        },
        token: number
    ) => {
        const url = buildResolveUrl({
            type: opts.type,
            id: opts.id,
            season: opts.type === 'tv' ? opts.season ?? 1 : 0,
            episode: opts.type === 'tv' ? opts.episode ?? 1 : 0,
            server: opts.server
        });
        const data = await fetchResolve(url);
        if (!isResolveActive(token)) throw new ResolveAborted();
        if (!data.streams?.length) {
            return fetchResolveForPlayback(opts, token);
        }
        const title = data.meta?.title || '';
        if (streamsLookCorrupt(title, data.streams)) {
            dbg('player:resolve:quick-corrupt-fallback', { title });
            return fetchResolveForPlayback(opts, token);
        }
        return data;
    };

    const fetchResolveForPlayback = async (
        opts: {
            type: 'movie' | 'tv';
            id: string;
            season?: number;
            episode?: number;
            server?: number;
        },
        token: number
    ) => {
        const types: Array<'movie' | 'tv'> = [opts.type];
        const altType = opts.type === 'tv' ? 'movie' : 'tv';
        types.push(altType);

        let lastCorrupt: MoovieResolve | null = null;

        for (const type of types) {
            if (!isResolveActive(token)) throw new ResolveAborted();

            const url = buildResolveUrl({
                type,
                id: opts.id,
                season: type === 'tv' ? opts.season ?? 1 : 0,
                episode: type === 'tv' ? opts.episode ?? 1 : 0,
                server: opts.server
            });

            let data = await fetchResolve(url);
            if (!isResolveActive(token)) throw new ResolveAborted();

            if (data.streamWarning) {
                try {
                    const altUrl = buildResolveUrl({
                        type: altType,
                        id: opts.id,
                        season: altType === 'tv' ? opts.season ?? 1 : 0,
                        episode: altType === 'tv' ? opts.episode ?? 1 : 0,
                        server: opts.server
                    });
                    const altData = await fetchResolve(altUrl);
                    if (!isResolveActive(token)) throw new ResolveAborted();
                    if (!altData.streamWarning && (altData.streams?.length || 0) > 0) {
                        dbg('player:resolve:fallback-type', {
                            from: type,
                            to: altType,
                            title: altData.meta?.title
                        });
                        data = altData;
                    }
                } catch {
                    /* keep primary resolve */
                }
            }

            const title = data.meta?.title || '';
            if (!streamsLookCorrupt(title, data.streams || [])) {
                if (type !== opts.type) {
                    dbg('player:resolve:corrupt-retry', {
                        from: opts.type,
                        to: type,
                        title
                    });
                }
                return data;
            }

            lastCorrupt = data;
            dbg('player:resolve:corrupt', { type, title, streamCount: data.streams?.length ?? 0 });
        }

        if (lastCorrupt?.streams?.length) {
            throw new Error(
                'Stream mismatch — the catalogue returned the wrong video for this title. Try another entry or search again.'
            );
        }

        throw new Error('No stream available for this title. Try again in a moment.');
    };

    const bindVideoClickToggle = () => {
        const video = (plyrInstance as any)?.media as HTMLVideoElement | undefined;
        if (!video || videoClickHandler) return;

        videoClickHandler = (event: MouseEvent) => {
            event.stopPropagation();
            if (!plyrInstance) return;
            dbg('player:video-click');
            plyrInstance.togglePlay();
        };
        video.addEventListener('click', videoClickHandler);
    };

    const switchStreamUrl = async (
        stream: MoovieStream,
        opts: PlaybackResumeOptions = {}
    ) => {
        if (!plyrInstance) return false;

        const resumeAt =
            opts.resumeAt ?? plyrInstance.currentTime ?? currentTime.value ?? 0;
        const resumePlaying = opts.resumePlaying ?? isPlaying.value;

        plyrInstance.pause();
        isPlaying.value = false;

        dbg('player:switch-url', {
            quality: stream.quality,
            resumeAt,
            resumePlaying
        });

        // Plyr doesn't have switchUrl. We need to recreate the player or swap source.
        // Re-creating is more robust, especially since Hls.js might be in use.
        try {
            await preparePlayback(stream, activeResolveUrl, {
                allowRefresh: false,
                resume: { resumeAt, resumePlaying }
            });
            return true;
        } catch (err) {
            dbgError('player:switch-url:fail', err);
            return false;
        }
    };

    const bindPlaybackEvents = () => {
        if (!plyrInstance) return;

        const syncTime = () => {
            if (!plyrInstance) return;
            currentTime.value = plyrInstance.currentTime || 0;
            duration.value = plyrInstance.duration || 0;
            isMuted.value = plyrInstance.muted;
            buffered.value = plyrInstance.buffered * plyrInstance.duration;
            if (
                playbackEnded.value &&
                plyrInstance.duration > 0 &&
                plyrInstance.duration - plyrInstance.currentTime > 2
            ) {
                playbackEnded.value = false;
            }
        };

        plyrInstance.on('timeupdate', syncTime);
        plyrInstance.on('playing', () => {
            dbg('player:play');
            isPlaying.value = true;
            syncTime();
        });
        plyrInstance.on('pause', () => {
            dbg('player:pause');
            isPlaying.value = false;
        });
        plyrInstance.on('ended', () => {
            dbg('player:ended');
            playbackEnded.value = true;
            isPlaying.value = false;
        });
        plyrInstance.on('volumechange', syncTime);
        plyrInstance.on('error', () => {
            void handlePlaybackError();
        });

        bindVideoClickToggle();
    };

    const playbackFailureMessage = (streams: MoovieStream[]) => {
        const hasMkv = streams.some((s) => /\.mkv/i.test(s.url));
        if (!extensionActive.value && hasMkv) {
            return 'Playback failed. This title may need the Moovie extension for MKV streams — try another quality or reload.';
        }
        return 'Playback failed — try another quality or reload.';
    };

    const handlePlaybackError = async () => {
        const retryToken = ++playbackRetryToken;
        const streams = resolved.value?.streams || [];
        dbgError('player:error', {
            index: selectedStreamIndex.value,
            quality: streams[selectedStreamIndex.value]?.quality,
            retries: playbackErrorRetries
        });

        if (!streams.length || !activeResolveUrl) {
            playbackError.value = playbackFailureMessage(streams);
            return;
        }

        failedStreamIndices.add(selectedStreamIndex.value);
        playbackError.value = '';

        while (failedStreamIndices.size < streams.length) {
            const fromIndex = selectedStreamIndex.value;
            const nextIndex = findNextFallbackStreamIndex(
                streams,
                failedStreamIndices,
                fromIndex
            );
            if (nextIndex < 0) break;

            playbackErrorRetries++;
            selectedStreamIndex.value = nextIndex;
            const stream = streams[nextIndex];
            dbg('player:error:retry-quality', {
                from: fromIndex,
                to: nextIndex,
                quality: stream.quality
            });

            try {
                const ok = plyrInstance
                    ? await switchStreamUrl(stream, {
                          resumeAt: currentTime.value,
                          resumePlaying: isPlaying.value
                       })
                    : await (async () => {
                          await preparePlayback(stream, activeResolveUrl, {
                              allowRefresh: false
                          });
                          return true;
                      })();
                if (retryToken !== playbackRetryToken) return;
                if (ok) {
                    playbackErrorRetries = 0;
                    failedStreamIndices.clear();
                    return;
                }
            } catch (err) {
                if (retryToken !== playbackRetryToken) return;
                dbgError('player:error:retry-quality-fail', err);
            }

            failedStreamIndices.add(nextIndex);
        }

        if (retryToken !== playbackRetryToken) return;
        dbg('player:error:refresh-resolve', { url: activeResolveUrl });
        resolveCache.delete(activeResolveUrl);
        const fresh = await refreshResolve(activeResolveUrl);
        if (retryToken !== playbackRetryToken) return;
        if (fresh?.streams?.length) {
            failedStreamIndices.clear();
            selectedStreamIndex.value = pickDefaultStreamIndex(fresh.streams);
            try {
                await preparePlayback(
                    fresh.streams[selectedStreamIndex.value],
                    activeResolveUrl,
                    { allowRefresh: false }
                );
                if (retryToken !== playbackRetryToken) return;
                playbackErrorRetries = 0;
                return;
            } catch (err) {
                if (retryToken !== playbackRetryToken) return;
                dbgError('player:error:refresh-resolve-fail', err);
            }
        }

        playbackError.value = playbackFailureMessage(streams);
    };

    const buildResolveUrl = buildMoovieResolveUrl;
    const fetchResolve = fetchMoovieResolve;

    const pickDefaultStreamIndex = (streams: MoovieStream[]) => {
        if (!streams.length) return 0;
        let bestIndex = 0;
        let bestScore = scoreStreamForDefault(streams[0]);
        for (let i = 1; i < streams.length; i++) {
            const score = scoreStreamForDefault(streams[i]);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }
        return bestIndex;
    };

    const resolvePlaybackUrl = (stream: MoovieStream) => {
        return withPlaybackCacheBuster(stream.url);
    };

    const waitForContainer = async (timeoutMs = 4000) => {
        dbg('player:wait-container');
        if (artContainer.value) return;
        const started = Date.now();
        while (!artContainer.value && Date.now() - started < timeoutMs) {
            await nextTick();
            await new Promise((r) => window.setTimeout(r, 40));
        }
        if (!artContainer.value) {
            dbgError('player:container-missing', { waitedMs: Date.now() - started });
            throw new Error('Player container missing');
        }
        dbg('player:container-ready', { waitedMs: Date.now() - started });
    };

    const isEmbeddedFrame = () => {
        try {
            return window.parent !== window;
        } catch {
            return true;
        }
    };

    const waitForExtension = async (timeoutMs = isEmbeddedFrame() ? 1500 : 200) => {
        dbg('player:wait-extension', { timeoutMs, embedded: isEmbeddedFrame() });
        pingExtension();
        checkExtension();
        if (extensionActive.value) {
            dbg('player:extension-active');
            return;
        }

        await new Promise<void>((resolve) => {
            const started = Date.now();
            const timer = window.setInterval(() => {
                checkExtension();
                pingExtension();
                if (extensionActive.value || Date.now() - started >= timeoutMs) {
                    window.clearInterval(timer);
                    dbg('player:extension-wait-done', {
                        active: extensionActive.value,
                        waitedMs: Date.now() - started
                    });
                    resolve();
                }
            }, 120);
        });
    };

    const mountPlyr = async (
        stream: MoovieStream,
        resume: PlaybackResumeOptions = {}
    ) => {
        dbg('player:mount:start', { quality: stream.quality, extension: extensionActive.value });
        const container = artContainer.value;
        if (!container) throw new Error('Player container missing');

        clearArtInstance();
        const playUrl = resolvePlaybackUrl(stream);
        const resumeAt = resume.resumeAt ?? 0;
        const resumePlaying = resume.resumePlaying ?? true;
        dbg('player:mount:url', {
            quality: stream.quality,
            viaExtension: extensionActive.value,
            resumeAt,
            resumePlaying
        });

        const isNetflix = skin === 'netflix';
        const streamType = detectStreamMediaType(stream.url);

        const video = document.createElement('video');
        video.className = 'plyr-video-element';
        video.controls = false;
        video.playsInline = true;
        video.autoplay = resumePlaying;
        video.preload = 'auto';
        container.appendChild(video);

        if (streamType === 'mkv') {
            await loadHlsJs();
            const HlsCtor = (window as any).Hls;
            if (HlsCtor && HlsCtor.isSupported()) {
                hlsInstance = new HlsCtor({ enableWorker: true });
                hlsInstance.loadSource(playUrl);
                hlsInstance.attachMedia(video);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = playUrl;
            } else {
                throw new Error('HLS/MKV playback is not supported in this browser.');
            }
        } else {
            video.src = playUrl;
        }

        // Apply resume parameters to the native video element directly or on loadedmetadata
        if (resumeAt > 0 || !resumePlaying) {
            let resumed = false;
            const applyResume = () => {
                if (resumed) return;
                resumed = true;
                if (resumeAt > 0) {
                    video.currentTime = resumeAt;
                    currentTime.value = resumeAt;
                }
                if (!resumePlaying) {
                    video.pause();
                }
            };
            video.addEventListener('loadedmetadata', applyResume);
            video.addEventListener('canplay', applyResume);
        }

        plyrInstance = new Plyr(video, {
            autoplay: resumePlaying,
            controls: isNetflix ? [] : ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
            settings: isNetflix ? [] : ['quality', 'speed', 'loop']
        });

        bindPlaybackEvents();

        artReady.value = true;
        dbg('player:mount:ready', { quality: stream.quality });
    };

    const togglePlay = () => {
        if (!plyrInstance) return;
        plyrInstance.togglePlay();
    };

    const pausePlayback = () => {
        if (!plyrInstance) return;
        plyrInstance.pause();
        isPlaying.value = false;
    };

    const seekTo = (time: number) => {
        if (!plyrInstance) return;
        plyrInstance.currentTime = Math.max(0, Math.min(time, duration.value || time));
        currentTime.value = plyrInstance.currentTime;
    };

    const skipBack = (seconds = 10) => {
        seekTo((currentTime.value || 0) - seconds);
    };

    const toggleMute = () => {
        if (!plyrInstance) return;
        plyrInstance.muted = !plyrInstance.muted;
        isMuted.value = plyrInstance.muted;
    };

    const progress = computed(() => {
        if (!duration.value) return 0;
        return Math.min(100, (currentTime.value / duration.value) * 100);
    });

    const bufferProgress = computed(() => {
        if (!duration.value) return 0;
        return Math.min(100, (buffered.value / duration.value) * 100);
    });

    const refreshResolve = async (
        resolveUrl: string
    ): Promise<MoovieResolve | null> => {
        if (refreshInFlight) return refreshInFlight;
        refreshInFlight = (async () => {
            try {
                const data = await fetchResolve(resolveUrl);
                resolved.value = data;
                return data;
            } catch {
                return null;
            } finally {
                refreshInFlight = null;
            }
        })();
        return refreshInFlight;
    };

    const preparePlayback = async (
        stream: MoovieStream | null,
        resolveUrl: string,
        options: { allowRefresh?: boolean; resume?: PlaybackResumeOptions } = {}
    ): Promise<void> => {
        const { allowRefresh = true, resume } = options;
        const token = ++prepareToken;
        activeResolveUrl = resolveUrl;
        clearArtInstance();
        if (!stream) return;

        dbg('player:prepare', { quality: stream?.quality, allowRefresh });
        const ageSec = streamUrlAgeSec(stream.url);
        if (ageSec !== null && ageSec > 120 && allowRefresh) {
            dbg('player:prepare:stale-url', { ageSec });
            const fresh = await refreshResolve(resolveUrl);
            if (token !== prepareToken || !fresh?.streams?.length) return;
            selectedStreamIndex.value = pickDefaultStreamIndex(fresh.streams);
            return preparePlayback(
                fresh.streams[selectedStreamIndex.value],
                resolveUrl,
                { allowRefresh: false, resume }
            );
        }

        try {
            if (!extensionActive.value) {
                const resp = await fetch(stream.url, {
                    method: 'GET',
                    headers: { Range: 'bytes=0-65535' }
                });
                if (!resp.ok && resp.status !== 206 && allowRefresh) {
                    dbg('player:prepare:probe-fail', { status: resp.status });
                    const fresh = await refreshResolve(resolveUrl);
                    if (token !== prepareToken || !fresh?.streams?.length) return;
                    selectedStreamIndex.value = pickDefaultStreamIndex(fresh.streams);
                    return preparePlayback(
                        fresh.streams[selectedStreamIndex.value],
                        resolveUrl,
                        { allowRefresh: false, resume }
                    );
                }
            }
            if (token !== prepareToken) return;
            await waitForContainer();
            await mountPlyr(stream, resume);
            playbackError.value = '';
            playbackErrorRetries = 0;
            failedStreamIndices.clear();
        } catch (err: any) {
            if (token !== prepareToken) return;
            dbgError('player:prepare:fail', err);
            const needsExtensionHint =
                !extensionActive.value &&
                (isEmbeddedFrame() ||
                    /proxy|403|failed|network/i.test(String(err?.message || '')));
            playbackError.value = needsExtensionHint
                ? 'Playback failed. Install the Moovie extension and reload — Watch Together needs it for catalogue streams.'
                : err?.message || 'Playback failed. Install the Moovie Stream Boost extension.';
        }
    };

    const resolveAndPlay = async (
        opts: {
            type: 'movie' | 'tv';
            id: string;
            season?: number;
            episode?: number;
            server?: number;
        },
        resume: PlaybackResumeOptions = {}
    ) => {
        const token = ++resolveToken;
        dbg('player:resolve:start', { ...opts, resume, token });
        loading.value = true;
        playbackError.value = '';
        streamWarning.value = '';
        destroyArt();

        try {
            await waitForContainer();
            if (!isResolveActive(token)) return;

            const resolveTask = fetchResolveForPlayback(opts, token);

            await Promise.all([
                resolveTask,
                waitForExtension()
            ]);

            if (!isResolveActive(token)) return;

            const data = await resolveTask;
            const url = buildResolveUrl({
                type: data.resolveType === 'tv' ? 'tv' : opts.type,
                id: opts.id,
                season: data.resolveSeason ?? opts.season ?? 0,
                episode: data.resolveEpisode ?? opts.episode ?? 0,
                server: opts.server
            });
            activeResolveUrl = url;

            resolved.value = data;
            streamWarning.value = data.streamWarning || '';
            selectedStreamIndex.value = pickDefaultStreamIndex(data.streams || []);
            dbg('player:resolve:ok', {
                title: data.meta?.title,
                streamCount: data.streams?.length ?? 0,
                quality: data.streams?.[selectedStreamIndex.value]?.quality,
                token
            });
            const stream = data.streams?.[selectedStreamIndex.value] || null;
            await preparePlayback(stream, url, { resume });
        } catch (err: any) {
            if (err instanceof ResolveAborted || !isResolveActive(token)) return;
            dbgError('player:resolve:fail', err);
            playbackError.value = err?.message || 'Could not resolve stream.';
        } finally {
            if (isResolveActive(token)) {
                loading.value = false;
            }
        }
    };

    const pickStreamIndexPreservingQuality = (
        streams: MoovieStream[],
        preferredQuality?: string
    ) => {
        if (!streams.length) return 0;
        if (preferredQuality) {
            const idx = streams.findIndex((s) => s.quality === preferredQuality);
            if (idx >= 0) return idx;
        }
        return pickDefaultStreamIndex(streams);
    };

    const switchResolveEntry = async (
        opts: {
            type: 'movie' | 'tv';
            id: string;
            season?: number;
            episode?: number;
            server?: number;
        },
        resume: PlaybackResumeOptions = {}
    ) => {
        const token = ++resolveToken;
        dbg('player:switch-entry:start', { ...opts, resume, token });
        playbackError.value = '';

        const preferredQuality =
            resolved.value?.streams?.[selectedStreamIndex.value]?.quality;
        const data = plyrInstance
            ? await fetchResolveQuick(opts, token)
            : await fetchResolveForPlayback(opts, token);
        if (!isResolveActive(token)) throw new ResolveAborted();

        const url = buildResolveUrl({
            type: data.resolveType === 'tv' ? 'tv' : opts.type,
            id: opts.id,
            season: data.resolveSeason ?? opts.season ?? 0,
            episode: data.resolveEpisode ?? opts.episode ?? 0,
            server: opts.server
        });
        activeResolveUrl = url;

        resolved.value = data;
        streamWarning.value = data.streamWarning || '';
        selectedStreamIndex.value = pickStreamIndexPreservingQuality(
            data.streams || [],
            preferredQuality
        );

        const stream = data.streams?.[selectedStreamIndex.value] || null;
        if (!stream) throw new Error('No stream available for this audio.');

        if (plyrInstance) {
            const ok = await switchStreamUrl(stream, resume);
            if (!isResolveActive(token)) throw new ResolveAborted();
            if (!ok) throw new Error('Could not switch audio track.');
            playbackError.value = '';
            return;
        }

        await preparePlayback(stream, url, { resume });
    };

    const switchQuality = async (index: number, resolveUrl: string) => {
        const resumeAt = currentTime.value;
        const resumePlaying = isPlaying.value;
        dbg('player:quality:switch', {
            index,
            quality: resolved.value?.streams?.[index]?.quality,
            resumeAt,
            resumePlaying
        });
        selectedStreamIndex.value = index;
        const stream = resolved.value?.streams?.[index] || null;
        if (!stream) return;
        if (plyrInstance) {
            await switchStreamUrl(stream, { resumeAt, resumePlaying });
            return;
        }
        await preparePlayback(stream, resolveUrl, {
            resume: { resumeAt, resumePlaying }
        });
    };

    watch(extensionActive, async (active) => {
        if (!active || !plyrInstance || !resolved.value?.streams?.length) return;
        const stream = resolved.value.streams[selectedStreamIndex.value];
        if (!stream) return;
        dbg('player:extension-switch-url', { quality: stream.quality });
        try {
            await switchStreamUrl(stream, {
                resumeAt: currentTime.value,
                resumePlaying: isPlaying.value
            });
            playbackError.value = '';
        } catch (err) {
            dbgError('player:extension-switch-url:fail', err);
        }
    });

    onBeforeUnmount(() => {
        destroyArt();
    });

    return {
        extensionActive,
        loading,
        playbackError,
        streamWarning,
        resolved,
        selectedStreamIndex,
        artReady,
        artContainer,
        isPlaying,
        currentTime,
        duration,
        buffered,
        isMuted,
        playbackEnded,
        progress,
        bufferProgress,
        resolveAndPlay,
        switchResolveEntry,
        resetPlaybackSession,
        switchQuality,
        togglePlay,
        pausePlayback,
        seekTo,
        skipBack,
        toggleMute,
        destroyArt,
        pickDefaultStreamIndex
    };
}