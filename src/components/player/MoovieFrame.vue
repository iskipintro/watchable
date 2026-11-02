<template>
    <div
        ref="rootRef"
        class="moovie-frame"
        :class="{ 'has-error': error, 'is-buffering': buffering, 'is-controls-hidden': controlsHidden, 'is-embedding': embedOpen && activeEmbedId !== 'native' }"
        :style="{
            '--sub-bg-opacity': subtitleBgOpacity,
            '--sub-text-opacity': subtitleTextOpacity,
            '--sub-font-size': subtitleFontSize + '%',
            '--sub-position': subtitlePosition + '%'
        }"
    >
        <div class="moovie-frame__stage">
            <div class="moovie-frame__player">
                <video ref="videoRef" class="moovie-frame__video" />

                <!-- OpenSubtitles overlay: rendered from parsed cues, locked to
                     video.currentTime — avoids native text-track drift. -->
                <div
                    v-if="osSubActive"
                    class="moovie-frame__subtitle-overlay"
                    aria-live="polite"
                    v-html="activeCueTextFormatted"
                />

                <!-- SMOV-style loading/scraping surface, backed by Moovie's
                     existing provider progress state. -->
                <Transition name="moovie-loader">
                    <div v-if="loading" class="moovie-frame__loader" role="status" aria-live="polite">
                        <div class="moovie-frame__loader-spinner" aria-hidden="true">
                            <span />
                        </div>
                        <div class="moovie-frame__loader-copy">
                            <span class="moovie-frame__loader-kicker">Finding a playable source</span>
                            <strong>{{ title }}</strong>
                            <span class="moovie-frame__loader-status">
                                {{ activeProviderStatus || (activeProviderName ? `Searching ${activeProviderName}…` : 'Connecting to sources…') }}
                            </span>
                        </div>
                    </div>
                </Transition>



                <div v-if="!loading && !error" class="moovie-frame__center-btn" @click="togglePlay">
                    <div v-if="buffering" class="moovie-frame__spinner" />
                    <div v-else-if="!playing" class="moovie-frame__big-play-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19" /></svg>
                    </div>
                    <button
                        type="button"
                        class="moovie-frame__center-skip moovie-frame__center-skip--back"
                        @click.stop="seekBy(-15)"
                        aria-label="Rewind 15 seconds"
                        title="Rewind 15 seconds"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
                            <text x="12" y="15" text-anchor="middle" fill="currentColor" stroke="none" font-size="7" font-family="system-ui, sans-serif" font-weight="700">15</text>
                        </svg>
                    </button>
                    <button
                        type="button"
                        class="moovie-frame__center-skip moovie-frame__center-skip--fwd"
                        @click.stop="seekBy(15)"
                        aria-label="Forward 15 seconds"
                        title="Forward 15 seconds"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
                            <text x="12" y="15" text-anchor="middle" fill="currentColor" stroke="none" font-size="7" font-family="system-ui, sans-serif" font-weight="700">15</text>
                        </svg>
                    </button>
                </div>

                <div v-if="error && !loading && !playbackStarted" class="moovie-frame__overlay moovie-frame__overlay--error">
                    <p class="eyebrow">Hub Error</p>
                    <h3>{{ error }}</h3>
                    <button type="button" class="moovie-frame__retry" @click="retry">Retry</button>
                </div>

                <ul
                    v-if="!loading && !error && qualityOpen && (uniqueQualities.length > 1 || hlsQualities.length > 0)"
                    ref="qualityRootRef"
                    class="moovie-frame__quality-menu"
                >
                    <template v-if="hlsQualities.length > 0">
                        <li role="option" :aria-selected="selectedHlsQuality === -1">
                            <button
                                type="button"
                                class="moovie-frame__quality-item"
                                :class="{ 'is-active': selectedHlsQuality === -1 }"
                                @click.stop="selectHlsQuality(-1)"
                            >
                                Auto
                            </button>
                        </li>
                        <li
                            v-for="q in hlsQualities"
                            :key="q.id"
                            role="option"
                            :aria-selected="selectedHlsQuality === q.id"
                        >
                            <button
                                type="button"
                                class="moovie-frame__quality-item"
                                :class="{ 'is-active': selectedHlsQuality === q.id }"
                                @click.stop="selectHlsQuality(q.id)"
                            >
                                {{ q.label }}
                            </button>
                        </li>
                    </template>
                    <template v-else-if="uniqueQualities.length > 1">
                        <li
                            v-for="(q, i) in uniqueQualities"
                            :key="i"
                            role="option"
                            :aria-selected="selectedQualityIndex === i"
                        >
                            <button
                                type="button"
                                class="moovie-frame__quality-item"
                                :class="{ 'is-active': selectedQualityIndex === i }"
                                @click.stop="selectQuality(i)"
                            >
                                {{ q }}
                            </button>
                        </li>
                    </template>
                </ul>

                <div v-if="!loading && !error" class="moovie-frame__seekbar">
                    <input
                        type="range"
                        class="moovie-frame__seek-input"
                        min="0"
                        :max="duration || 0"
                        step="0.1"
                        :value="currentTime"
                        @input="seek"
                        @mousedown="seeking = true"
                        @mouseup="seeking = false"
                        @touchstart="seeking = true"
                        @touchend="seeking = false"
                        aria-label="Seek"
                    />
                    <div class="moovie-frame__seek-track" :class="{ 'is-active': seeking }">
                        <div class="moovie-frame__seek-fill" :style="{ width: duration ? (currentTime / duration * 100) + '%' : '0%' }">
                            <div class="moovie-frame__seek-thumb" />
                        </div>
                    </div>
                </div>

                <div v-if="!loading && !error" class="moovie-frame__controls" @mouseenter="isHoveringControls = true; resetIdleTimer()" @mouseleave="isHoveringControls = false; resetIdleTimer()">
                    <div class="moovie-frame__controls-left">
                        <button v-if="mediaType === 'tv'" class="moovie-frame__ctrl-btn" @click="$emit('prev-episode')" aria-label="Previous Episode">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4" /><rect x="5" y="4" width="2" height="16" rx="0.5" /></svg>
                        </button>
                        <button class="moovie-frame__ctrl-btn moovie-frame__mobile-skip" @click="seekBy(-15)" aria-label="Rewind 15 seconds" title="Rewind 15 seconds">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
                                <text x="12" y="15" text-anchor="middle" fill="currentColor" stroke="none" font-size="7" font-family="system-ui, sans-serif" font-weight="700">15</text>
                            </svg>
                        </button>
                        <button class="moovie-frame__ctrl-btn" :class="{ 'is-active': playing }" @click="togglePlay" aria-label="Play/Pause">
                            <svg v-if="!playing" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
                            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        </button>
                        <button class="moovie-frame__ctrl-btn moovie-frame__mobile-skip" @click="seekBy(15)" aria-label="Forward 15 seconds" title="Forward 15 seconds">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
                                <text x="12" y="15" text-anchor="middle" fill="currentColor" stroke="none" font-size="7" font-family="system-ui, sans-serif" font-weight="700">15</text>
                            </svg>
                        </button>
                        <button v-if="mediaType === 'tv'" class="moovie-frame__ctrl-btn" @click="$emit('next-episode')" aria-label="Next Episode">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20" /><rect x="17" y="4" width="2" height="16" rx="0.5" /></svg>
                        </button>
                        <span class="moovie-frame__time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
                    </div>
                    <div class="moovie-frame__controls-right">
                        <button
                            class="moovie-frame__ctrl-btn moovie-frame__subtitle-toggle"
                            :class="{ 'is-active': selectedSubtitleTrack !== -1 }"
                            :disabled="!subtitleTracks.length"
                            :aria-pressed="selectedSubtitleTrack !== -1"
                            :aria-label="selectedSubtitleTrack !== -1 ? 'Turn subtitles off' : 'Turn subtitles on'"
                            :title="selectedSubtitleTrack !== -1 ? 'Subtitles on' : 'Subtitles off'"
                            @click.stop="toggleSubtitles"
                        >
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
                                <path d="M7.5 10h3M13.5 10h3M7.5 14h9" />
                            </svg>
                        </button>
                        <div class="moovie-frame__volume-control">
                            <button
                                class="moovie-frame__ctrl-btn"
                                :class="{ 'is-active': muted }"
                                @click.stop="handleVolumeButtonClick"
                                :aria-label="muted ? 'Unmute' : 'Mute'"
                                :title="muted ? 'Unmute' : 'Volume'"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" /><path v-if="!muted" d="M15.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /><path v-if="!muted" d="M19 12c0 2.97-1.65 5.54-4 6.71v2.06c3.45-1.28 6-4.56 6-8.77s-2.55-7.49-6-8.77v2.06c2.35 1.17 4 3.74 4 6.71z" /><line v-if="muted" x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
                            </button>
                            <transition name="fade">
                                <div v-if="volumeSliderOpen" class="moovie-frame__volume-slider-popup" @click.stop>
                                    <input
                                        type="range"
                                        class="moovie-frame__volume-vertical-slider"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        :value="muted ? 0 : volume"
                                        @input="onVolumeChange"
                                        aria-label="Volume"
                                    />
                                </div>
                            </transition>
                        </div>
                        <button
                            class="moovie-frame__ctrl-btn moovie-frame__cast-btn"
                            @click.stop="handleCastToTV"
                            aria-label="Cast to TV"
                            title="Cast to Smart TV / Chromecast / AirPlay"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.92-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                            </svg>
                        </button>
                        <button
                            class="moovie-frame__ctrl-btn moovie-frame__three-dot-btn"
                            :class="{ 'is-open': settingsOpen }"
                            @click.stop="settingsOpen ? (settingsOpen = false, settingsSection = null) : (settingsOpen = true, qualityOpen = false)"
                            aria-label="Settings"
                            :aria-expanded="settingsOpen"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                            </svg>
                        </button>
                        <button class="moovie-frame__ctrl-btn" :class="{ 'is-active': isFullscreen }" @click="toggleFullscreen" aria-label="Fullscreen">
                            <svg v-if="!isFullscreen" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
                            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>
                        </button>
                    </div>
                </div>

                <Transition name="moovie-settings">
                    <div v-if="settingsOpen" class="moovie-frame__settings-panel" @click.stop>
                        <div class="moovie-frame__settings-mobile-handle" />
                        <div class="moovie-frame__settings-header">
                            <button
                                v-if="settingsSection"
                                class="moovie-frame__settings-back"
                                @click="settingsSection = null"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                            </button>
                            <div class="moovie-frame__settings-heading">
                                <span class="moovie-frame__settings-eyebrow">{{ settingsSection ? 'Player settings' : 'Playback settings' }}</span>
                                <span class="moovie-frame__settings-title">{{ settingsSection ? settingsSection.charAt(0).toUpperCase() + settingsSection.slice(1) : title }}</span>
                            </div>
                        </div>

                        <div class="moovie-frame__settings-scroll">
                            <template v-if="!settingsSection">
                                <button class="moovie-frame__settings-item" @click="settingsSection = 'quality'; qualityOpen = false">
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Quality</span>
                                    <span class="moovie-frame__settings-item-value">{{ hlsQualityLabel }}</span>
                                    <svg class="moovie-frame__settings-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                </button>
                                <button class="moovie-frame__settings-item" @click="settingsSection = 'server'">
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Source</span>
                                    <span class="moovie-frame__settings-item-value">{{ selectedServer || 'Auto' }}</span>
                                    <svg class="moovie-frame__settings-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                </button>
                                <button class="moovie-frame__settings-item" @click="settingsSection = 'subtitles'">
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="14" x2="23" y2="14"/><path d="M7 14h4"/><path d="M13 14h4"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Subtitles</span>
                                    <span class="moovie-frame__settings-item-value">{{ subtitleTracks.length ? currentSubtitleLabel : 'Search' }}</span>
                                    <svg class="moovie-frame__settings-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                </button>
                                <button class="moovie-frame__settings-item" @click="settingsSection = 'audio'">
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Audio</span>
                                    <span class="moovie-frame__settings-item-value">{{ currentAudioLabel }}</span>
                                    <svg class="moovie-frame__settings-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                </button>
                                <div class="moovie-frame__settings-divider" />
                                <button class="moovie-frame__settings-item" @click="handleDownloadMedia">
                                    <span class="moovie-frame__settings-item-icon" aria-hidden="true">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    </span>
                                    <span class="sr-only">Download</span>
                                </button>
                                <div class="moovie-frame__settings-divider" />
                                <button class="moovie-frame__settings-item" @click="settingsSection = 'speed'">
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Playback</span>
                                    <span class="moovie-frame__settings-item-value">{{ playbackSpeed }}x</span>
                                    <svg class="moovie-frame__settings-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                </button>
                                <button class="moovie-frame__settings-item" @click="toggleSubtitles">
                                    <span class="moovie-frame__settings-item-label">Enable subtitles</span>
                                    <span class="moovie-frame__settings-item-badge" :class="{ 'is-on': selectedSubtitleTrack !== -1 }">{{ selectedSubtitleTrack !== -1 ? 'On' : 'Off' }}</span>
                                </button>
                            </template>

                            <template v-if="settingsSection === 'server'">
                                <button
                                    v-for="server in availableServers"
                                    :key="server.name"
                                    class="moovie-frame__settings-item"
                                    :class="{ 'is-active': selectedServer === server.name }"
                                    @click="selectServer(server.name)"
                                >
                                    <span class="moovie-frame__settings-item-status" :class="`is-${server.hasStreams ? 'success' : server.status}`">
                                        {{ server.hasStreams ? '✓' : server.status === 'pending' ? '⟳' : server.status === 'failure' ? '✕' : server.status === 'notfound' ? '–' : '○' }}
                                    </span>
                                    <span class="moovie-frame__settings-item-label">{{ server.name }}</span>
                                </button>
                            </template>

                            <template v-if="settingsSection === 'quality'">
                                <template v-if="hlsQualities.length > 0">
                                    <button
                                        class="moovie-frame__settings-item"
                                        :class="{ 'is-active': selectedHlsQuality === -1 }"
                                        @click="selectHlsQuality(-1)"
                                    >
                                        <span class="moovie-frame__settings-item-label">Auto</span>
                                        <span class="moovie-frame__settings-item-badge" :class="{ 'is-on': selectedHlsQuality === -1 }">Adaptive</span>
                                    </button>
                                    <button
                                        v-for="q in hlsQualities"
                                        :key="q.id"
                                        class="moovie-frame__settings-item"
                                        :class="{ 'is-active': selectedHlsQuality === q.id }"
                                        @click="selectHlsQuality(q.id)"
                                    >
                                        <span class="moovie-frame__settings-item-label">{{ q.label }}</span>
                                    </button>
                                </template>
                                <template v-else>
                                    <button
                                        v-for="(q, i) in uniqueQualities"
                                        :key="i"
                                        class="moovie-frame__settings-item"
                                        :class="{ 'is-active': selectedQualityIndex === i }"
                                        @click="selectQuality(i)"
                                    >
                                        <span class="moovie-frame__settings-item-label">{{ q }}</span>
                                    </button>
                                </template>
                            </template>

                            <template v-if="settingsSection === 'audio'">
                                <button
                                    v-for="track in audioTracks"
                                    :key="track.id"
                                    class="moovie-frame__settings-item"
                                    :class="{ 'is-active': selectedAudioTrack === track.id }"
                                    @click="selectAudioTrack(track.id)"
                                >
                                    <span class="moovie-frame__settings-item-label">{{ track.name }}</span>
                                    <span v-if="track.lang && track.lang !== track.name" class="moovie-frame__settings-item-hint">{{ track.lang }}</span>
                                </button>
                            </template>

                            <template v-if="settingsSection === 'subtitles'">
                                <div class="moovie-frame__settings-group">
                                    <span class="moovie-frame__settings-group-title">Timing Delay</span>
                                    <div class="moovie-frame__sync-row">
                                        <button class="moovie-frame__sync-btn" @click="changeSubtitleDelay(-0.5)">-0.5s</button>
                                        <span class="moovie-frame__sync-value">{{ subtitleDelay.toFixed(1) }}s</span>
                                        <button class="moovie-frame__sync-btn" @click="changeSubtitleDelay(0.5)">+0.5s</button>
                                        <button class="moovie-frame__sync-btn is-reset" @click="resetSubtitleDelay">Reset</button>
                                    </div>
                                </div>
                                <div class="moovie-frame__settings-divider" />
                                <div class="moovie-frame__settings-group">
                                    <div class="moovie-frame__settings-slider-header">
                                        <span class="moovie-frame__settings-group-title">Background</span>
                                        <span class="moovie-frame__settings-slider-value">{{ Math.round(subtitleBgOpacity * 100) }}%</span>
                                    </div>
                                    <div class="moovie-frame__slider-wrapper">
                                        <input type="range" class="moovie-frame__settings-slider" min="0" max="1" step="0.05" v-model.number="subtitleBgOpacity" />
                                    </div>
                                </div>
                                <div class="moovie-frame__settings-group">
                                    <div class="moovie-frame__settings-slider-header">
                                        <span class="moovie-frame__settings-group-title">Text Opacity</span>
                                        <span class="moovie-frame__settings-slider-value">{{ Math.round(subtitleTextOpacity * 100) }}%</span>
                                    </div>
                                    <div class="moovie-frame__slider-wrapper">
                                        <input type="range" class="moovie-frame__settings-slider" min="0.1" max="1" step="0.05" v-model.number="subtitleTextOpacity" />
                                    </div>
                                </div>
                                <div class="moovie-frame__settings-group">
                                    <div class="moovie-frame__settings-slider-header">
                                        <span class="moovie-frame__settings-group-title">Font Size</span>
                                        <span class="moovie-frame__settings-slider-value">{{ subtitleFontSize }}%</span>
                                    </div>
                                    <div class="moovie-frame__slider-wrapper">
                                        <input type="range" class="moovie-frame__settings-slider" min="50" max="250" step="5" v-model.number="subtitleFontSize" />
                                    </div>
                                </div>
                                <div class="moovie-frame__settings-group">
                                    <span class="moovie-frame__settings-group-title">Position</span>
                                    <div class="moovie-frame__option-grid">
                                        <button type="button" class="moovie-frame__option-btn" @click="moveSubtitles('up')" title="Move Subtitles Up">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                                        </button>
                                        <button type="button" class="moovie-frame__option-btn" @click="moveSubtitles('down')" title="Move Subtitles Down">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                                        </button>
                                        <span class="moovie-frame__option-val">{{ 100 - subtitlePosition }}%</span>
                                    </div>
                                </div>
                                <div class="moovie-frame__settings-divider" />
                                <span class="moovie-frame__settings-group-title" style="padding: 0 0.75rem;">Tracks</span>
                                <button
                                    class="moovie-frame__settings-item"
                                    :class="{ 'is-active': selectedSubtitleTrack === -1 }"
                                    @click="selectSubtitleTrack(-1)"
                                >
                                    <span class="moovie-frame__settings-item-label">Off</span>
                                </button>
                                <button
                                    v-for="track in subtitleTracks"
                                    :key="track.id"
                                    class="moovie-frame__settings-item"
                                    :class="{ 'is-active': selectedSubtitleTrack === track.id }"
                                    @click="selectSubtitleTrack(track.id)"
                                >
                                    <span class="moovie-frame__settings-item-label">{{ track.name }}</span>
                                    <span v-if="track.lang && track.lang !== track.name" class="moovie-frame__settings-item-hint">{{ track.lang }}</span>
                                </button>
                                <button
                                    v-if="!subtitleTracks.length"
                                    class="moovie-frame__settings-item"
                                    @click="loadOpenSubtitles()"
                                >
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Search subtitles</span>
                                </button>
                            </template>

                            <template v-if="settingsSection === 'speed'">
                                <div class="moovie-frame__speed-grid">
                                    <button
                                        v-for="spd in PLAYBACK_SPEEDS"
                                        :key="spd"
                                        class="moovie-frame__speed-btn"
                                        :class="{ 'is-active': playbackSpeed === spd }"
                                        @click="setPlaybackSpeed(spd)"
                                    >
                                        {{ spd }}x
                                    </button>
                                </div>
                            </template>
</div>
                     </div>
                 </Transition>
             </div>

            <div v-if="embedOpen && activeEmbedId !== 'native'" class="moovie-frame__embed-overlay is-open" @click.self="toggleEmbedMode">
                <div v-if="embedOpen && embedLoading" class="moovie-frame__embed-loader" aria-hidden="true">
                    <div class="moovie-frame__spinner" />
                </div>
                <div
                    v-for="src in embedSources"
                    :key="src.id"
                    class="moovie-frame__embed-pane"
                    :class="{ 'is-active': activeEmbedId === src.id }"
                >
                    <iframe
                        v-if="src.enabled && activeEmbedId === src.id && paneSrc[src.id]"
                        class="moovie-frame__embed-frame"
                        :src="paneSrc[src.id]"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowfullscreen
                        referrerpolicy="no-referrer"
                        @load="onEmbedLoaded(src.id)"
                    />
                </div>
            </div>

            <!-- Server selector pill — rendered ABOVE embed overlay so iframe cannot intercept it -->
            <div v-if="!loading && !error && !isFullscreen" class="moovie-frame__mobile-server-btn-wrap">
                <button
                    type="button"
                    class="moovie-frame__mobile-server-btn"
                    :class="{ 'is-active': mobileServersOpen }"
                    @click.stop="toggleMobileServers"
                    aria-label="Select Server"
                >
                    <svg class="moovie-frame__mobile-server-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                        <line x1="6" y1="6" x2="6.01" y2="6"/>
                        <line x1="6" y1="18" x2="6.01" y2="18"/>
                    </svg>
                    <span class="moovie-frame__mobile-server-text">{{ activeServerLabel }}</span>
                    <svg class="moovie-frame__mobile-server-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>

                <!-- Compact server menu — anchored to pill, slides down, never under any iframe -->
                <Transition name="moovie-server-menu">
                    <div
                        v-if="mobileServersOpen"
                        class="moovie-frame__server-menu"
                        @click.stop
                    >
                        <button
                            v-for="src in embedSources"
                            :key="src.id"
                            type="button"
                            class="moovie-frame__server-menu-item"
                            :class="{ 'is-active': activeEmbedId === src.id, 'is-disabled': !src.enabled }"
                            :disabled="!src.enabled"
                            @click="selectMobileServer(src.id)"
                        >
                            <span class="moovie-frame__server-menu-name">{{ src.label }}</span>
                            <svg v-if="activeEmbedId === src.id" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.9">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </button>
                    </div>
                </Transition>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { startProgressTracking } from '@/composables/user/useProgress'
import { usePlaybackRoute } from '@/composables/streaming/usePlaybackRoute'
import { getSyncClient } from '../../lib/syncClient'

const HUB_BASE = ''
const STREAMSCRAPER_HUB = ''
const OPENSUBTITLES_API = `/api/subtitles`

interface LanguageVariant {
    language: string
    label: string
    provider: string
    id: string           // format "provider:catalogId"
    type: 'movie' | 'show'
    season?: number
    episode?: number
    catalogId?: string
    // Pre-resolved variant (e.g. Shankar resolves every language at scrape time):
    // when url is set, selectAudioTrack plays it directly instead of re-resolving.
    url?: string
    headers?: Record<string, string>
    streamType?: 'm3u8' | 'mp4'
}

/** Mirror of smov fetchLanguageVariants — parallel multi-provider search */
async function fetchLanguageVariantsFromHub(
    title: string,
    type: 'movie' | 'show',
    tmdbId?: string | number,
    season?: number,
    episode?: number
): Promise<LanguageVariant[]> {
    try {
        const providers = ['moovie-catalog', 'homecine', 'zetflix']
        const promises: Promise<LanguageVariant[]>[] = providers.map(async (provider) => {
            const fetchProviderVariants = async (attempt = 0): Promise<LanguageVariant[]> => {
                let ctrl: AbortController | null = null
                let timeout: ReturnType<typeof setTimeout> | null = null
                try {
                const params = new URLSearchParams({ q: title, type, provider })
                if (tmdbId) params.set('tmdbId', String(tmdbId))
                if (season != null) params.set('season', String(season))
                if (episode != null) params.set('episode', String(episode))
                    ctrl = new AbortController()
                    timeout = setTimeout(() => ctrl?.abort(), 45_000)
                    const res = await fetch(`${STREAMSCRAPER_HUB}/api/search?${params}`, { signal: ctrl.signal })
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    const json = await res.json().catch(() => null)
                    if (!json || typeof json !== 'object') throw new Error('Invalid response')
                    const items: any[] = json.results?.flatMap?.((result: any) =>
                        (result.streams || (result._languageVariants ? [result] : []))
                            .flatMap((stream: any) => Array.isArray(stream._languageVariants) ? stream._languageVariants : [])
                    ) ?? []
                    return items.map((variant: any): LanguageVariant => ({
                        language: variant.language ?? 'unknown',
                        label: variant.language ?? 'Unknown',
                        provider,
                        id: `${provider}:${variant.catalogId ?? variant.id ?? ''}`,
                        type: variant.media_type === 'tv' ? 'show' : (variant.type ?? type),
                        season: variant.season,
                        episode: variant.episode,
                    }))
                } catch (error) {
                    // HomeCine provides the dependable regional audio variants. Retry it
                    // once because an in-flight source scan can briefly cancel this request.
                    if (provider === 'homecine' && attempt === 0) {
                        await new Promise(resolve => setTimeout(resolve, 750))
                        return fetchProviderVariants(1)
                    }
                    console.warn('[MoovieFrame] language variant request failed:', provider, error)
                    return []
                } finally {
                    if (timeout) clearTimeout(timeout)
                }
            }
            return fetchProviderVariants()
        })

        // French (fss), German (streamkiste), Chinese (iyf) — movie only, matches smov
        const idStr = tmdbId ? String(tmdbId) : ''
        if (type === 'movie' && idStr) {
            const specialEndpoints: Array<{ key: string; language: string; provider: string }> = [
                { key: 'fss', language: 'french',  provider: 'fss' },
                { key: 'de',  language: 'german',  provider: 'streamkiste' },
                { key: 'zh',  language: 'chinese', provider: 'iyf' },
            ]
            for (const ep of specialEndpoints) {
                promises.push((async () => {
                    try {
                        const params = new URLSearchParams({ tmdbId: idStr, type, title })
                        const ctrl = new AbortController()
                        const t = setTimeout(() => ctrl.abort(), 30_000)
                        try {
                            const res = await fetch(`${STREAMSCRAPER_HUB}/api/variants/${ep.key}?${params}`, { signal: ctrl.signal })
                            if (!res.ok) return []
                            const json = await res.json().catch(() => null)
                            if (!json?.variants?.length) return []
                            return json.variants.map((v: any): LanguageVariant => ({
                                language: v.language || ep.language,
                                label: v.label || ep.language.charAt(0).toUpperCase() + ep.language.slice(1),
                                provider: ep.provider,
                                id: `${ep.provider}:${v.id || idStr}`,
                                type: 'movie',
                            }))
                        } finally { clearTimeout(t) }
                    } catch { return [] }
                })())
            }
        }

        const results = await Promise.all(promises)
        const allVariants = results.flat()

        // Dedup by id; when same language has multiple providers, append provider name
        const counts = new Map<string, number>()
        for (const v of allVariants) {
            const lk = `${v.language.toLowerCase()}:${v.episode ?? ''}`
            counts.set(lk, (counts.get(lk) ?? 0) + 1)
        }
        const seen = new Set<string>()
        const unique: LanguageVariant[] = []
        for (const v of allVariants) {
            if (seen.has(v.id)) continue
            seen.add(v.id)
            const lk = `${v.language.toLowerCase()}:${v.episode ?? ''}`
            unique.push({
                ...v,
                label: (counts.get(lk) ?? 0) > 1 ? `${v.label} · ${v.provider}` : v.label,
            })
        }
        return unique
    } catch { return [] }
}

/** Mirror of smov resolveLanguageVariantUrl — resolves provider:id to a playable URL */
async function resolveLanguageVariantUrl(
    id: string,
    type: 'movie' | 'show',
    season?: number,
    episode?: number
): Promise<{ url: string; type: 'm3u8' | 'mp4'; proxyUrl?: string; headers?: Record<string, string> } | null> {
    try {
        let provider = 'moovie-catalog'
        let actualId = id
        if (id.includes(':')) {
            const idx = id.indexOf(':')
            provider = id.substring(0, idx)
            actualId = id.substring(idx + 1)
        }
        const params = new URLSearchParams({ provider, id: actualId, type })
        if (season != null) params.set('season', String(season))
        if (episode != null) params.set('episode', String(episode))
        const res = await fetch(`${STREAMSCRAPER_HUB}/api/resolve-variant?${params}`)
        if (!res.ok) return null
        const json = await res.json().catch(() => null)
        if (!json) return null
        const url = json.proxyUrl
            ? STREAMSCRAPER_HUB + json.proxyUrl
            : (json.url || '')
        if (!url) return null
        const responseType = String(json.type ?? '').toLowerCase()
        const isHls = responseType === 'm3u8' || responseType === 'hls' || url.includes('.m3u8')
        return { 
            url, 
            type: isHls ? 'm3u8' : 'mp4', 
            proxyUrl: json.proxyUrl ? STREAMSCRAPER_HUB + json.proxyUrl : undefined,
            headers: json.headers
        }
    } catch { return null }
}

interface OpenSubtitle {
    id: string
    url: string
    language: string
    type: string
    needsProxy: boolean
    opensubtitles: boolean
}

function srtToVtt(srt: string): string {
    let text = srt.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    // Already a VTT file — don't double-header it or corrupt timestamps
    if (/^WEBVTT\b/m.test(text)) {
        return text.endsWith('\n') ? text : text + '\n'
    }
    // SRT: convert `,` millisecond separators to `.` (VTT requires dots).
    // Allow single-digit hours — some files use `1:02:03,456`.
    text = text.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    return 'WEBVTT\n\n' + text + (text.endsWith('\n') ? '' : '\n')
}

interface ParsedCue {
    start: number
    end: number
    text: string
}

/** Parse VTT/SRT text into plain {start, end, text} cues. Rendering these
 *  ourselves (instead of native <track> elements) keeps captions exactly
 *  locked to video.currentTime — no browser text-track latency or latch. */
function parseSubtitleCues(vttText: string): ParsedCue[] {
    const text = vttText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
    const cues: ParsedCue[] = []
    const timeRe = /^(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})/
    const toSecs = (h: string, m: string, s: string, ms: string) =>
        Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000
    let current: { start: number; end: number; lines: string[] } | null = null
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const m = line.match(timeRe)
        if (m) {
            if (current) {
                cues.push({ start: current.start, end: current.end, text: current.lines.join('\n') })
            }
            current = {
                start: toSecs(m[1], m[2], m[3], m[4]),
                end: toSecs(m[5], m[6], m[7], m[8]),
                lines: [],
            }
            continue
        }
        // Skip SRT cue numbering ("1", "2", ...) — a bare number followed by a
        // timestamp is an index line, not subtitle text.
        if (/^\d{1,5}$/.test(line.trim()) && i + 1 < lines.length && timeRe.test(lines[i + 1])) {
            continue
        }
        if (current && line.trim()) {
            // strip VTT/HTML inline tags, keep plain text
            current.lines.push(line.replace(/<[^>]*>/g, '').trim())
        }
    }
    if (current) {
        cues.push({ start: current.start, end: current.end, text: current.lines.join('\n') })
    }
    return cues
}

interface ProviderStatus {
    id: string
    name: string
    status: 'waiting' | 'pending' | 'success' | 'failure' | 'notfound'
    percentage: number
    error?: string
    cacheStatus?: string
}

interface HubStream {
    name: string
    url: string
    proxyUrl: string
    quality: string
    type: string
    headers?: Record<string, string>
    providerName?: string
    providerId?: string
    proxyMode?: 'inherit' | 'on' | 'off'
    qualities?: string[]
}

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

        function normalizeProxyMode(raw?: string | null): 'inherit' | 'on' | 'off' {
            if (raw === '0' || raw === 'off') return 'off'
            if (raw === '1' || raw === 'vps' || raw === 'cf' || raw === 'on') return 'on'
            return 'inherit'
        }

        function shouldUseProxy(stream: HubStream) {
            if (stream.proxyMode === 'on') return true
            if (stream.proxyMode === 'off') return false
            return routeProxyEnabled(adminProxyEnabled)
        }

export default defineComponent({
    name: 'MoovieFrame',
    props: {
        mediaId: { type: [String, Number], default: '' },
        mediaType: { type: String as () => 'movie' | 'tv' | 'anime', default: 'movie' },
        season: { type: Number, default: 0 },
        episode: { type: Number, default: 0 },
        autoEmbed: { type: Boolean, default: false },
        title: { type: String, default: 'Stream' },
        backdropPath: { type: String, default: '' },
        posterPath: { type: String, default: '' },
        audioMode: { type: String as () => 'sub' | 'dub', default: 'sub' },
        anilistId: { type: [String, Number], default: 0 },
    },
    emits: ['next-episode', 'prev-episode', 'embed-change'],
    setup(props, ctx) {
        const rootRef = ref<HTMLElement | null>(null)
        const videoRef = ref<HTMLVideoElement | null>(null)
        const currentAudioMode = ref<'sub' | 'dub'>(props.audioMode || 'sub')
        watch(() => props.audioMode, (newMode) => {
            if (newMode && newMode !== currentAudioMode.value) {
                currentAudioMode.value = newMode
                void doLoad()
            }
        })
        function changeAudioMode(mode: 'sub' | 'dub') {
            currentAudioMode.value = mode
            void doLoad()
        }

        const subtitleDelay = ref(0)
        const subtitleBgOpacity = ref(0.75)
        const subtitleTextOpacity = ref(1.0)
        const subtitleFontSize = ref(100)
        const subtitlePosition = ref(95)

        const activeCueText = ref('')
        const activeCueTextFormatted = computed(() => {
            return activeCueText.value.replace(/\n/g, '<br>')
        })

        function updateActiveCueText() {
            const video = videoRef.value
            if (!video) return
            const sel = selectedSubtitleTrack.value
            // OpenSubtitles: overlay-rendered. Look up the active cue against
            // the live playhead with the delay applied at lookup time — no
            // native text track, no cue mutation, so captions stay exact.
            if (sel >= OPENSUBS_TRACK_OFFSET) {
                const cues = osSubCues.get(sel)
                if (cues && cues.length) {
                    const t = video.currentTime - subtitleDelay.value
                    for (let i = 0; i < cues.length; i++) {
                        const c = cues[i]
                        if (t >= c.start && t < c.end) {
                            activeCueText.value = c.text
                            return
                        }
                    }
                }
                activeCueText.value = ''
                return
            }
            // HLS-embedded subs: rendered natively by the browser/hls.js.
            let showingTrack: TextTrack | null = null
            for (let i = 0; i < video.textTracks.length; i++) {
                const track = video.textTracks[i]
                if (track.mode === 'showing') {
                    showingTrack = track
                    break
                }
            }
            if (showingTrack && showingTrack.activeCues && showingTrack.activeCues.length > 0) {
                // Get the text from the active cue(s)
                const texts: string[] = []
                for (let j = 0; j < showingTrack.activeCues.length; j++) {
                    const cue = showingTrack.activeCues[j] as VTTCue
                    if (cue && cue.text) {
                        texts.push(cue.text.replace(/<[^>]+>/g, '')) // strip HTML tags
                    }
                }
                if (texts.length > 0) {
                    activeCueText.value = texts.join('\n')
                    return
                }
            }
            activeCueText.value = ''
        }

        async function handleCastToTV() {
            const castWindow = window as any;
            const video = videoRef.value as HTMLVideoElement | null;

            // 1. Google Cast Framework (Chromecast / Android TV / Google TV in Chrome, Brave, Edge)
            if (castWindow.cast?.framework) {
                try {
                    const castContext = castWindow.cast.framework.CastContext.getInstance();
                    try {
                        castContext.setOptions({
                            receiverApplicationId: castWindow.chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
                            autoJoinPolicy: castWindow.chrome?.cast?.AUTO_JOIN_POLICY?.ORIGIN_SCOPED || 'origin_scoped'
                        });
                    } catch (e) {
                        // Options already set
                    }

                    const session = await castContext.requestSession();
                    if (session && video) {
                        const streamUrl = video.currentSrc || video.src || (streams.value && streams.value[selectedQualityIndex.value]?.url);
                        if (streamUrl) {
                            const contentType = streamUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
                            const mediaInfo = new castWindow.chrome.cast.media.MediaInfo(streamUrl, contentType);
                            const request = new castWindow.chrome.cast.media.LoadRequest(mediaInfo);
                            request.currentTime = video.currentTime || 0;
                            session.loadMedia(request);
                        }
                    }
                    return;
                } catch (castErr: any) {
                    console.debug('[Cast] Google Cast session request note:', castErr);
                    if (castErr === 'cancel' || castErr?.code === 'cancel' || castErr === 'cancel_session_start') return;
                }
            }

            // 2. Native AirPlay support (Safari, iOS, macOS)
            if (video && typeof (video as any).webkitShowPlaybackTargetPicker === 'function') {
                (video as any).webkitShowPlaybackTargetPicker();
                return;
            }

            // 3. Browser Remote Playback API
            if (video && (video as any).remote && typeof (video as any).remote.prompt === 'function') {
                try {
                    await (video as any).remote.prompt();
                    return;
                } catch (err: any) {
                    console.debug('[Cast] Remote playback prompt error:', err);
                }
            }

            alert('Cast feature is unavailable on this browser or no casting devices were detected on your local network. Make sure your Chromecast or TV is powered on and connected to the same Wi-Fi network.');
        }

        function handleDownloadMedia() {
            const video = videoRef.value as HTMLVideoElement | null;
            const hub4kStream = streams.value?.find(s => (s.providerName || (s as any).provider || '').toLowerCase().includes('4khdhub'));
            const currentStream = hub4kStream || streams.value?.[selectedQualityIndex.value] || streams.value?.[0];
            let targetUrl = currentStream?.url || currentStream?.proxyUrl || video?.currentSrc || video?.src;

            if (!targetUrl) {
                alert('No active video stream found to download.');
                return;
            }

            // Decode proxied URLs back to the direct file when possible.
            // Direct R2/google URLs already carry Content-Disposition: attachment,
            // so opening them starts a real download without any proxy.
            try {
                const u = new URL(targetUrl, window.location.origin);
                if (u.searchParams.get('u') && u.pathname.includes('/proxy')) {
                    const b64 = u.searchParams.get('u')!;
                    const direct = decodeURIComponent(escape(atob(b64.replace(/-/g, '+').replace(/_/g, '/'))));
                    if (/^https?:\/\//i.test(direct)) targetUrl = direct;
                }
            } catch (err) {
                // keep targetUrl as-is
            }

            const titleClean = (props.title || 'media').replace(/[^a-zA-Z0-9_\-]/g, '_');
            let epSuffix = '';
            if (props.mediaType === 'tv' && props.season && props.episode) {
                epSuffix = `_S${String(props.season).padStart(2, '0')}E${String(props.episode).padStart(2, '0')}`;
            }
            const qualityLabel = currentStream?.quality || activeQualityLabel.value || 'HD';
            const fileName = `${titleClean}${epSuffix}_${qualityLabel}.mp4`;

            // Direct download, no proxy. Cross-origin <a download> is ignored by
            // browsers, so open the URL directly — the CDN serves it as an
            // attachment (R2 signed URLs include response-content-disposition).
            try {
                const a = document.createElement('a');
                a.href = targetUrl;
                a.download = fileName;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (err) {
                // Last resort: open directly (browser may play it instead of downloading)
                console.warn('[Download] Direct link failed, opening in new tab:', err);
                window.open(targetUrl, '_blank');
            }
        }

        function resolveFullLanguageName(code?: string): string {
            if (!code) return 'Unknown';
            const cleaned = code.trim().toLowerCase();
            const map: Record<string, string> = {
                'en': 'English', 'eng': 'English',
                'hi': 'Hindi', 'hin': 'Hindi',
                'es': 'Spanish', 'spa': 'Spanish',
                'fr': 'French', 'fra': 'French', 'fre': 'French',
                'de': 'German', 'deu': 'German', 'ger': 'German',
                'it': 'Italian', 'ita': 'Italian',
                'ja': 'Japanese', 'jpn': 'Japanese',
                'ko': 'Korean', 'kor': 'Korean',
                'zh': 'Chinese', 'zho': 'Chinese', 'chi': 'Chinese',
                'ru': 'Russian', 'rus': 'Russian',
                'ar': 'Arabic', 'ara': 'Arabic',
                'pt': 'Portuguese', 'por': 'Portuguese',
                'nl': 'Dutch', 'nld': 'Dutch', 'dut': 'Dutch',
                'tr': 'Turkish', 'tur': 'Turkish',
                'pl': 'Polish', 'pol': 'Polish',
                'sv': 'Swedish', 'swe': 'Swedish',
                'vi': 'Vietnamese', 'vie': 'Vietnamese',
                'th': 'Thai', 'tha': 'Thai',
                'id': 'Indonesian', 'ind': 'Indonesian',
                'ms': 'Malay', 'msa': 'Malay',
                'fa': 'Persian', 'fas': 'Persian',
                'he': 'Hebrew', 'heb': 'Hebrew',
                'uk': 'Ukrainian', 'ukr': 'Ukrainian',
                'ro': 'Romanian', 'ron': 'Romanian', 'rum': 'Romanian',
                'el': 'Greek', 'ell': 'Greek', 'gre': 'Greek',
                'cs': 'Czech', 'ces': 'Czech', 'cze': 'Czech',
                'hu': 'Hungarian', 'hun': 'Hungarian',
                'fi': 'Finnish', 'fin': 'Finnish',
                'no': 'Norwegian', 'nor': 'Norwegian',
                'da': 'Danish', 'dan': 'Danish',
                'sk': 'Slovak', 'slk': 'Slovak', 'slo': 'Slovak',
                'bg': 'Bulgarian', 'bul': 'Bulgarian',
                'hr': 'Croatian', 'hrv': 'Croatian',
                'sr': 'Serbian', 'srp': 'Serbian',
                'sl': 'Slovenian', 'slv': 'Slovenian',
                'et': 'Estonian', 'est': 'Estonian',
                'lv': 'Latvian', 'lav': 'Latvian',
                'lt': 'Lithuanian', 'lit': 'Lithuanian',
                'tl': 'Tagalog', 'tgl': 'Tagalog',
            };
            if (map[cleaned]) return map[cleaned];
            const prefix = cleaned.split('-')[0];
            if (map[prefix]) return map[prefix];
            return code.charAt(0).toUpperCase() + code.slice(1);
        }

        function adjustCueStyles() {
            const video = videoRef.value;
            if (!video) return;
            const delay = subtitleDelay.value;
            const pos = subtitlePosition.value;
            for (let i = 0; i < video.textTracks.length; i++) {
                const track = video.textTracks[i];
                const cues = track.cues;
                if (!cues) continue;
                for (let j = 0; j < cues.length; j++) {
                    const cue = cues[j] as VTTCue;
                    if ((cue as any)._originalStartTime === undefined) {
                        (cue as any)._originalStartTime = cue.startTime;
                        (cue as any)._originalEndTime = cue.endTime;
                    }
                    // Clamp to >= 0: Chrome silently drops cues with negative times.
                    cue.startTime = Math.max(0, (cue as any)._originalStartTime + delay);
                    cue.endTime = Math.max(0, (cue as any)._originalEndTime + delay);
                    cue.snapToLines = false;
                    cue.line = pos;
                }
            }
        }

        /** Force the browser to re-evaluate activeCues against the live playhead.
         *  Without this, a track activated at append time latches its cue lookup
         *  to the position where it was attached and captions run late. */
        function reSyncSubtitleTracks() {
            const video = videoRef.value;
            if (!video) return;
            for (let i = 0; i < video.textTracks.length; i++) {
                const track = video.textTracks[i];
                if (!track || track.mode !== 'showing') continue;
                const cues = track.cues;
                if (!cues || !cues.length) continue;
                track.mode = 'hidden';
                setTimeout(() => {
                    if (track.mode === 'hidden' && videoRef.value) track.mode = 'showing';
                }, 0);
            }
        }

        function changeSubtitleDelay(amount: number) {
            subtitleDelay.value += amount
            adjustCueStyles()
            reSyncSubtitleTracks()
        }

        function resetSubtitleDelay() {
            subtitleDelay.value = 0
            adjustCueStyles()
            reSyncSubtitleTracks()
        }

        function moveSubtitles(direction: 'up' | 'down') {
            if (direction === 'up') {
                subtitlePosition.value = Math.max(0, subtitlePosition.value - 5)
            } else {
                subtitlePosition.value = Math.min(100, subtitlePosition.value + 5)
            }
            adjustCueStyles()
            reSyncSubtitleTracks()
        }

        const qualityRootRef = ref<HTMLElement | null>(null)
        const loading = ref(false)
        const error = ref('')
        const streams = ref<HubStream[]>([])
        const selectedStreamIndex = ref(0)
        const qualityOpen = ref(false)
        const buffering = ref(false)
        const seeking = ref(false)
        const settingsOpen = ref(false)
        const settingsSection = ref<string | null>(null)
        const selectedServer = ref('')
        const activeProviderStatus = ref('')

        const embedOpen = ref(false)
        const embedHasLoaded = ref(false)
        if (props.autoEmbed) {
            embedOpen.value = true
            settingsOpen.value = false
        }
        const activeEmbedId = ref('native')
        interface EmbedSource {
            id: string
            label: string
            enabled: boolean
            build: (mediaType: 'movie' | 'tv', id: string, season: number, episode: number) => string
        }
        const embedSources: EmbedSource[] = [
            {
                id: 'native',
                label: 'Moovie Player',
                enabled: true,
                build: () => '',
            },
        ]
        function clearAllEmbedPanes() {
            for (const src of embedSources) {
                paneSrc[src.id] = ''
                embedLoaded[src.id] = false
            }
        }

        function switchEmbed(sourceId: string) {
            const src = embedSources.find(s => s.id === sourceId)
            if (!src || !src.enabled) return
            if (activeEmbedId.value === sourceId && paneSrc[sourceId]) return
            const prev = activeEmbedId.value
            activeEmbedId.value = sourceId

            // Selecting an embed from the native player must open the embed overlay.
            if (sourceId !== 'native' && !embedOpen.value) {
                embedOpen.value = true
                ctx.emit('embed-change', true)
                const video = videoRef.value
                if (video) video.pause()
            }

            if (prev === 'native') {
                const video = videoRef.value
                if (video) video.pause()
            }

            // Immediately clear ALL inactive panes to instantly terminate old iframe audio
            for (const s of embedSources) {
                if (s.id !== sourceId) {
                    paneSrc[s.id] = ''
                    embedLoaded[s.id] = false
                }
            }

            if (sourceId === 'native') {
                const video = videoRef.value
                // In auto-embed mode doLoad() never runs at mount (it only fires
                // when the embed pane is closed), so switching to the native pane
                // must start the native scrape instead of play()ing an empty element.
                if (!streams.value.length && !loading.value && !originalStream.value) {
                    void doLoad()
                } else {
                    if (video) void video.play().catch(() => {})
                }
            } else {
                embedLoaded[sourceId] = false
                paneSrc[sourceId] = embedUrls.value[sourceId] || ''
                // Fallback timeout in case cross-origin iframe does not trigger @load
                setTimeout(() => {
                    embedLoaded[sourceId] = true
                }, 2500)
            }
        }

        const mobileServersOpen = ref(false)
        const activeServerLabel = computed(() => {
            const found = embedSources.find(s => s.id === activeEmbedId.value)
            return found ? found.label : 'Moovie Player'
        })
        function toggleMobileServers() {
            mobileServersOpen.value = !mobileServersOpen.value
            if (mobileServersOpen.value) resetIdleTimer()
        }
        function selectMobileServer(sourceId: string) {
            switchEmbed(sourceId)
            mobileServersOpen.value = false
        }

        watch([settingsOpen, mobileServersOpen], ([settings, servers]) => {
            if (typeof document !== 'undefined') {
                const isMobile = typeof window !== 'undefined' && (window.matchMedia('(max-width: 768px), (pointer: coarse)').matches)
                const lock = (settings || servers) && (isMobile || settings)
                if (lock) {
                    document.documentElement.style.overflow = 'hidden'
                    document.body.style.overflow = 'hidden'
                } else {
                    document.documentElement.style.overflow = ''
                    document.body.style.overflow = ''
                }
            }
        })
        const embedUrl = computed(() => {
            const id = String(props.mediaId)
            const src = embedSources.find(s => s.id === activeEmbedId.value) || embedSources[0]
            const targetType = (props.mediaType === 'anime' ? 'tv' : props.mediaType) as 'movie' | 'tv'
            return src.build(targetType, id, props.season || 1, props.episode || 1)
        })
        const embedUrls = computed<Record<string, string>>(() => {
            const map: Record<string, string> = {}
            const id = String(props.mediaId)
            if (!id) return map
            const targetType = (props.mediaType === 'anime' ? 'tv' : props.mediaType) as 'movie' | 'tv'
            for (const src of embedSources) {
                if (!src.enabled || src.id === 'native') continue
                map[src.id] = src.build(targetType, id, props.season || 1, props.episode || 1)
            }
            return map
        })
        const paneSrc = reactive<Record<string, string>>({})
        const embedLoaded = reactive<Record<string, boolean>>({})

        // Pre-warm the first enabled embed in a hidden off-screen iframe so it
        // is already loaded before the user even opens the embed panel.
        // We defer by 800ms to not compete with the native player startup.
        let prewarmTimer: ReturnType<typeof setTimeout> | null = null
        watch(
            embedUrls,
            (urls) => {
                const defaultId = embedSources.find(s => s.enabled && s.id !== 'native')?.id
                if (!defaultId || !urls[defaultId]) return
                // If panel is already open, keep the live src in sync
                if (embedOpen.value && activeEmbedId.value !== 'native') {
                    if (!paneSrc[activeEmbedId.value]) {
                        paneSrc[activeEmbedId.value] = urls[activeEmbedId.value] || ''
                    }
                    return
                }
                // Otherwise pre-warm default embed in background
                if (!paneSrc[defaultId]) {
                    if (prewarmTimer) clearTimeout(prewarmTimer)
                    prewarmTimer = setTimeout(() => {
                        if (!embedOpen.value && !paneSrc[defaultId]) {
                            paneSrc[defaultId] = urls[defaultId]
                        }
                    }, 800)
                }
            },
            { immediate: true }
        )
        const embedLoading = computed(() => activeEmbedId.value !== 'native' && !embedLoaded[activeEmbedId.value])
        function onEmbedLoaded(id: string) {
            embedLoaded[id] = true
        }
        function toggleEmbedMode() {
            embedOpen.value = !embedOpen.value
            ctx.emit('embed-change', embedOpen.value)
            if (embedOpen.value) {
                settingsOpen.value = false
                if (activeEmbedId.value === 'native') {
                    if (!streams.value.length && !loading.value && !originalStream.value) {
                        void doLoad()
                    }
                } else {
                    const video = videoRef.value
                    if (video) video.pause()
                }
                // Clear all EXCEPT the active pane
                for (const s of embedSources) {
                    if (s.id !== activeEmbedId.value) {
                        paneSrc[s.id] = ''
                        embedLoaded[s.id] = false
                    }
                }
                // If active is an iframe and not yet populated, populate now
                if (activeEmbedId.value !== 'native' && !paneSrc[activeEmbedId.value]) {
                    paneSrc[activeEmbedId.value] = embedUrls.value[activeEmbedId.value] || ''
                }
            } else {
                clearAllEmbedPanes()
                if (prewarmTimer) clearTimeout(prewarmTimer)
                // Re-queue pre-warm for next open
                prewarmTimer = setTimeout(() => {
                    const defaultId = embedSources.find(s => s.enabled && s.id !== 'native')?.id
                    if (defaultId && embedUrls.value[defaultId] && !paneSrc[defaultId]) {
                        paneSrc[defaultId] = embedUrls.value[defaultId]
                    }
                }, 800)
                if (props.autoEmbed && !embedHasLoaded.value) {
                    embedHasLoaded.value = true
                    void doLoad()
                }
            }
        }

        const STREAMLY_GENERAL_SERVERS = [
            { id: 'poseidon', name: 'Itachi' },
            { id: 'stellar_hls', name: 'Aomine' },
            { id: 'vixsrc_hls', name: 'Obito' },
            { id: 'salem_hls', name: 'Madara' },
            { id: 'purstream', name: 'Sasuke' },
            { id: 'rive_citadel', name: 'Luffy' },
            { id: 'rive_vanguard', name: 'L' },
            { id: 'atlantia', name: 'Tanjiro' },
            { id: 'movienight_auto', name: 'Minato' },
            { id: 'cinejoy_nebula', name: 'Mikasa' },
            { id: 'vidzee', name: 'Killua' },
            { id: 'orion', name: 'Kakashi' },
            { id: 'stellar_miami', name: 'Sukuna' },
            { id: 'cinejoy_lisbon', name: 'Naruto' },
            { id: 'cinejoy_hls', name: 'Hashirama' },
            { id: 'shiopa_hls', name: 'Eren' },
        ]

        const STREAMLY_ANIME_SERVERS = [
            { id: 'miruro_anime', name: 'Shisui' },
            { id: 'kazo_anime', name: 'Female Titan' },
            { id: 'kaa_anime', name: 'Yuji' },
            { id: 'animeparadise', name: 'AnimeParadise' },
            { id: 'kyoo_anime', name: 'Toji' },
            { id: 'juju_anime', name: 'Levi' },
            { id: 'lufi_anime', name: 'Goku' },
            { id: 'poseidon_anime', name: 'Itachi Anime' },
            { id: 'orion_anime', name: 'Tengen' },
        ]

        async function loadEnabledProviderList(): Promise<ProviderStatus[]> {
            const isAnime = (props.mediaType as string) === 'anime' || Boolean(props.title && /anime/i.test(props.title))
            const raw = isAnime ? [...STREAMLY_ANIME_SERVERS, ...STREAMLY_GENERAL_SERVERS] : STREAMLY_GENERAL_SERVERS
            providers.value = raw.map(s => ({
                id: s.id,
                name: s.name,
                status: 'waiting' as const,
                percentage: 0,
            }))
            return providers.value
        }

        const loadServerOverrides = async () => {
            try {
                const sync = await getSyncClient()
                const { data } = await sync
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'default_server_overrides')
                    .single()
                if (data?.value) {
                    const overrides = JSON.parse(data.value)
                    const key = `${props.mediaType}-${props.mediaId}`
                    if (overrides[key]) {
                        selectedServer.value = overrides[key]
                        console.debug('[MoovieFrame] Loaded server override:', selectedServer.value)
                    }
                }
            } catch { /* ignore */ }
        }
        const audioTracks = ref<{ id: number; name: string; lang?: string; _catalogId?: string }[]>([])
        const selectedAudioTrack = ref(-1)
        const languageVariants = ref<LanguageVariant[]>([])
        let langVariantFetchKey = ''
        const subtitleTracks = ref<{ id: number; name: string; lang?: string; subUrl?: string; needsProxy?: boolean }[]>([])
        const selectedSubtitleTrack = ref(-1)
        /** Parsed OpenSubtitles cues, cached per track id. Rendered through our
         *  own overlay (see updateActiveCueText) instead of native <track>
         *  elements — native text-track rendering drifts against the MSE
         *  timeline, so we draw captions ourselves, locked to currentTime. */
        const osSubCues = new Map<number, ParsedCue[]>()
        let subsLoading = false
        const hlsQualities = ref<{ id: number; label: string; height: number }[]>([])
        const selectedHlsQuality = ref(-1)
        const OPENSUBS_TRACK_OFFSET = 1000

        const volumeSliderOpen = ref(false)
        const volume = ref(0.8)
        const originalStream = ref<HubStream | null>(null)
        // Provider-chain state so playback failures can advance to the next
        // provider even after doLoad's loop has already returned.
        const chainOrdered = ref<{ id: string; name: string }[]>([])
        const triedProviders = ref<Set<string>>(new Set())
        const lastTriedStream = ref<HubStream | null>(null)
        let hlsManifestParsed = false

        function onVolumeChange(e: Event) {
            const video = videoRef.value
            if (!video) return
            const val = parseFloat((e.target as HTMLInputElement).value)
            video.volume = val
            volume.value = val
            if (val > 0) {
                video.muted = false
                muted.value = false
            } else {
                video.muted = true
                muted.value = true
            }
        }
        function handleVolumeButtonClick() {
            if (!volumeSliderOpen.value) {
                volumeSliderOpen.value = true
            } else {
                toggleMute()
            }
        }

        const controlsHidden = ref(false)
        const isHoveringControls = ref(false)
        const embedSourcesIdle = ref(false)
        const brandText = computed(() => {
            if (typeof window !== 'undefined') {
                return window.location.hostname.includes('peestream') ? 'pee' : 'moovie'
            }
            return 'moovie'
        })
        let idleTimer: ReturnType<typeof setTimeout> | null = null
        function resetIdleTimer() {
            controlsHidden.value = false
            embedSourcesIdle.value = false
            if (idleTimer) clearTimeout(idleTimer)
            idleTimer = setTimeout(function() {
                const isMediaActive = playing.value || activeEmbedId.value !== 'native'
                if (isMediaActive && !seeking.value && !settingsOpen.value && !qualityOpen.value && !isHoveringControls.value) {
                    controlsHidden.value = true
                    mobileServersOpen.value = false
                }
            }, 3000)
        }
        function handleMouseLeave() {
            isHoveringControls.value = false
            const isMediaActive = playing.value || activeEmbedId.value !== 'native'
            if (isMediaActive && !seeking.value && !settingsOpen.value && !qualityOpen.value) {
                controlsHidden.value = true
                mobileServersOpen.value = false
                if (idleTimer) clearTimeout(idleTimer)
            }
        }

        // WatchTogether sync protocol
        let isRespondingToSync = false;
        let pendingSyncTime: number | null = null;
        let pendingSyncPlaying: boolean | null = null;
        let smoothSeekTimer: any = null;

        function reportPlayerEvent(event: 'play' | 'pause' | 'seek' | 'heartbeat' | 'ready' | 'complete', time?: number) {
            if (isRespondingToSync) return;
            if (typeof window === 'undefined' || window.parent === window) return;
            const video = videoRef.value;
            if (!video) return;
            // Clamp reported time to the media duration so guests never seek past it.
            let reportTime = time ?? video.currentTime;
            if (Number.isFinite(video.duration)) {
                reportTime = Math.min(Math.max(reportTime, 0), video.duration);
            }
            window.parent.postMessage({
                type: 'watchable-player-sync',
                event,
                time: reportTime,
                playing: !video.paused,
                duration: Number.isFinite(video.duration) ? video.duration : 0
            }, '*');
        }

        // Gently ease currentTime toward a slightly-off target instead of snapping,
        // so small per-heartbeat drift doesn't produce jarring jumps.
        function smoothSeekTo(target: number, video: HTMLVideoElement) {
            if (smoothSeekTimer) {
                clearInterval(smoothSeekTimer);
                smoothSeekTimer = null;
            }
            smoothSeekTimer = setInterval(() => {
                if (!videoRef.value) {
                    clearInterval(smoothSeekTimer);
                    smoothSeekTimer = null;
                    return;
                }
                if (video.paused || video.seeking) {
                    video.currentTime = target;
                    clearInterval(smoothSeekTimer);
                    smoothSeekTimer = null;
                    return;
                }
                const diff = target - video.currentTime;
                if (Math.abs(diff) <= 0.2) {
                    video.currentTime = target;
                    clearInterval(smoothSeekTimer);
                    smoothSeekTimer = null;
                    return;
                }
                video.currentTime += diff * 0.4;
            }, 120);
        }

        function clampToDuration(t: number, video: HTMLVideoElement) {
            if (!Number.isFinite(t)) return t;
            if (Number.isFinite(video.duration)) {
                return Math.min(Math.max(t, 0), video.duration);
            }
            return Math.max(t, 0);
        }

        function handleParentMessage(e: MessageEvent) {
            const data = e.data;
            if (!data || typeof data !== 'object') return;

            // Host responds to a guest sync request by reporting an immediate,
            // fresh heartbeat so guests get an accurate position rather than the
            // (up to 3s stale) cached heartbeat value.
            if (data.type === 'moovie-sync-poll') {
                reportPlayerEvent('heartbeat');
                return;
            }

            if (data.type !== 'moovie-command-sync') return;

            const video = videoRef.value;
            if (!video) return;

            if (video.readyState < 1) {
                if (data.time != null && Number.isFinite(data.time)) {
                    pendingSyncTime = data.time;
                }
                if (data.playing != null) {
                    pendingSyncPlaying = data.playing;
                }
                return;
            }

            isRespondingToSync = true;

            // Sync current time
            if (data.time != null && Number.isFinite(data.time)) {
                const target = clampToDuration(data.time, video);
                const diff = Math.abs(video.currentTime - target);
                if (diff > 2.5 || data.force) {
                    video.currentTime = target;
                } else if (diff > 0.8) {
                    // Small drift — ease toward the target instead of snapping.
                    smoothSeekTo(target, video);
                }
            }

            // Sync play/pause state
            if (data.playing != null) {
                if (data.playing && video.paused) {
                    video.play().catch(() => {});
                } else if (!data.playing && !video.paused) {
                    video.pause();
                }
            }

            setTimeout(() => {
                isRespondingToSync = false;
            }, 500);
        }

        const playing = ref(false)
        const currentTime = ref(0)
        const duration = ref(0)
        const muted = ref(false)
        const playbackSpeed = ref(1)
        const isPiP = ref(false)
        const isFullscreen = ref(false)
        const playbackStarted = ref(false)
        const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]
        let hlsInstance: any = null
        let activeSourceEventSource: EventSource | null = null
        let componentUnmounted = false
        let poseidonRefreshAttempts = 0
        let stopTracking: (() => void) | null = null

        // Streams visible for the currently active server — if a server is selected,
        // only show its streams; otherwise fall back to all streams.
        const activeServerStreams = computed(() => {
            if (selectedServer.value) {
                const group = streams.value.filter(s => s.providerName === selectedServer.value)
                if (group.length) return group
            }
            return streams.value
        })

        const uniqueQualities = computed(() => {
            const seen = new Set<string>()
            const out: string[] = []
            for (const s of activeServerStreams.value) {
                const q = s.quality || 'Auto'
                if (!seen.has(q)) {
                    seen.add(q)
                    out.push(q)
                }
            }
            return out
        })

        const selectedQualityIndex = computed(() => {
            const currentStream = streams.value[selectedStreamIndex.value]
            if (!currentStream) return 0
            const q = currentStream.quality || 'Auto'
            const idx = uniqueQualities.value.indexOf(q)
            return idx >= 0 ? idx : 0
        })

        const activeQualityLabel = computed(() => {
            return streams.value[selectedStreamIndex.value]?.quality || 'Auto'
        })

        const hlsQualityLabel = computed(() => {
            const sq = streams.value[selectedStreamIndex.value]?.quality
            if (sq && sq !== 'Auto') return sq
            if (selectedHlsQuality.value === -1) return 'Auto'
            const q = hlsQualities.value.find(l => l.id === selectedHlsQuality.value)
            return q?.label || 'Auto'
        })

        const availableServers = computed(() => {
            return providers.value.map(p => ({
                name: p.name,
                status: p.status,
                hasStreams: streams.value.some(s => s.providerName === p.name),
            }))
        })

                const currentAudioLabel = computed(() => {
            const track = audioTracks.value.find(t => t.id === selectedAudioTrack.value)
            const name = track?.name || ''
            if (!name || name.toLowerCase() === 'unknown' || name.toLowerCase() === 'und') {
                return 'English'
            }
            return name
        })

        const currentSubtitleLabel = computed(() => {
            if (selectedSubtitleTrack.value === -1) return 'Off'
            const track = subtitleTracks.value.find(t => t.id === selectedSubtitleTrack.value)
            return track?.name || 'Unknown'
        })

        const osSubActive = computed(() => {
            return selectedSubtitleTrack.value >= OPENSUBS_TRACK_OFFSET
        })

        const firstFrameShown = ref(false)

        const activeProviderName = computed(() => {
            const active = providers.value.find(p => p.status === 'pending') || providers.value.find(p => p.status === 'waiting')
            return active?.name || ''
        })


        const loadHlsJs = (() => {
            let promise: Promise<void> | null = null
            return () => {
                if ((window as any).Hls) return Promise.resolve()
                if (promise) return promise
                promise = new Promise((resolve) => {
                    const s = document.createElement('script')
                    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'
                    s.onload = () => resolve()
                    s.onerror = () => resolve()
                    document.head.appendChild(s)
                })
                return promise
            }
        })()

        function destroyPlayer() {
            if (hlsInstance) { try { hlsInstance.destroy() } catch {}; hlsInstance = null }
            hlsManifestParsed = false
            if (videoRef.value) { videoRef.value.removeAttribute('src'); videoRef.value.load() }
            osSubCues.clear()
            activeCueText.value = ''
            audioTracks.value = audioTracks.value.filter(t => (t as any)._catalogId || (t as any)._variantId || (t as any)._isOriginal)
            // Keep OpenSubtitles metadata so the selected sub survives
            // quality/server switches — only drop the HLS-managed tracks.
            subtitleTracks.value = subtitleTracks.value.filter(t => t.id >= OPENSUBS_TRACK_OFFSET)
        }

        async function mountPlayer(url: string, forceHls = false) {
            console.log('[MOVIEFRAME] mountPlayer - season:', props.season, 'episode:', props.episode, 'url:', url.slice(0, 120))
            destroyPlayer()
            qualityOpen.value = false
            buffering.value = true

            await loadHlsJs()
            if (componentUnmounted) {
                console.debug('[MoovieFrame] mount cancelled after component unmount')
                return
            }
            const HlsCtor = (window as any).Hls
            // Use HLS.js if the URL looks like m3u8 OR the caller explicitly says it's HLS
            // (proxy URLs like hahaevilcraft.site/proxy?id=... carry no extension)
            const isHls = forceHls || url.includes('.m3u8') || url.includes('m3u8')

            const video = videoRef.value
            if (!video) { console.debug('[MoovieFrame] mountPlayer no video element'); return }

            video.removeAttribute('src')
            video.controls = false
            video.playsInline = true
            video.autoplay = true
            video.playbackRate = playbackSpeed.value

            const onBufferEnd = () => {
                buffering.value = false
                playing.value = !video.paused
                if (playing.value || (video.currentTime > 0 && !video.paused)) {
                    loading.value = false
                }
            }
            const refreshPoseidonAfterPlaybackError = async () => {
                const source = originalStream.value as (HubStream & { providerId?: string }) | null
                const providerId = String(source?.providerId || '').toLowerCase()
                const providerName = String(source?.providerName || '').toLowerCase()
                const isPoseidon = providerId === 'vaplayer' || providerId === 'poseidon' || providerName === 'poseidon'
                if (!isPoseidon) return
                if (poseidonRefreshAttempts >= 1 || componentUnmounted) return
                poseidonRefreshAttempts++
                console.info('[MoovieFrame] Poseidon playback error; starting one fresh scrape', {
                    mediaId: props.mediaId,
                    mediaType: props.mediaType,
                    providerId,
                    providerName,
                })
                if (!componentUnmounted) await doLoad(true)
            }
            const onTimeUpdate = () => { currentTime.value = video.currentTime; duration.value = video.duration || 0; updateActiveCueText() }
            const onPlayPause = () => { 
                playing.value = !video.paused;
                reportPlayerEvent(video.paused ? 'pause' : 'play');
            }
            const onSeeked = () => {
                onBufferEnd();
                reportPlayerEvent('seek');
            }
            const applyPendingSync = () => {
                if (video.readyState >= 1) {
                    if (pendingSyncTime != null || pendingSyncPlaying != null) {
                        console.warn('[MoovieFrame] applyPendingSync executing. readyState:', video.readyState, 'pendingSyncTime:', pendingSyncTime, 'pendingSyncPlaying:', pendingSyncPlaying);
                        isRespondingToSync = true;
                        if (pendingSyncTime != null) {
                            video.currentTime = pendingSyncTime;
                            pendingSyncTime = null;
                        }
                        if (pendingSyncPlaying != null) {
                            if (pendingSyncPlaying && video.paused) {
                                video.play().catch((err) => {
                                    console.warn('[MoovieFrame] play() failed (likely autoplay policy):', err);
                                });
                            } else if (!pendingSyncPlaying && !video.paused) {
                                video.pause();
                            }
                            pendingSyncPlaying = null;
                        }
                        setTimeout(() => {
                            isRespondingToSync = false;
                        }, 500);
                    }
                }
            };

            video.addEventListener('loadedmetadata', applyPendingSync)
            video.addEventListener('loadeddata', applyPendingSync)
            video.addEventListener('canplay', applyPendingSync)
            video.addEventListener('play', applyPendingSync)

            const pendingSyncInterval = setInterval(() => {
                if (pendingSyncTime != null || pendingSyncPlaying != null) {
                    applyPendingSync();
                } else {
                    clearInterval(pendingSyncInterval);
                }
            }, 250);
            video.addEventListener('waiting', () => { buffering.value = true })
            video.addEventListener('playing', () => {
                loading.value = false
                buffering.value = false
                playbackStarted.value = true
                firstFrameShown.value = true
                onBufferEnd()
            })
            video.addEventListener('canplay', () => {
                onBufferEnd()
            })
            video.addEventListener('loadeddata', () => {
                onBufferEnd()
            })
            video.addEventListener('seeked', onSeeked)
            video.addEventListener('error', () => {
                console.error('[MoovieFrame][seek-trace] video error', {
                    currentTime: video.currentTime,
                    duration: video.duration,
                    seeking: video.seeking,
                    readyState: video.readyState,
                    networkState: video.networkState,
                    src: video.currentSrc || video.src || '',
                    mediaError: video.error ? { code: video.error.code, message: video.error.message } : null,
                })
                onBufferEnd()
            })
            video.addEventListener('error', () => { void refreshPoseidonAfterPlaybackError() }, { once: true })
            video.addEventListener('abort', onBufferEnd)
            video.addEventListener('timeupdate', () => {
                if (loading.value && video.currentTime > 0) {
                    loading.value = false
                }
                onTimeUpdate()
            })

            // Autoplay: the `autoplay` attribute alone is ignored by browsers when
            // sound is enabled and there's no user gesture, so force an explicit
            // play() right after a source is attached (NOT before — calling play()
            // on a source-less element rejects and would wrongly mute everything).
            // If the policy blocks it, fall back to muted playback and STAY muted —
            // unmuting without a gesture makes Chrome pause the video again.
            let autoplayTried = false
            const tryAutoplay = () => {
                if (autoplayTried || isRespondingToSync || !video.paused) return
                autoplayTried = true
                const p = video.play()
                if (p) {
                    p.catch(() => {
                        video.muted = true
                        muted.value = true
                        const p2 = video.play()
                        if (p2) p2.catch(() => {})
                    })
                }
            }
            video.addEventListener('canplay', tryAutoplay, { once: true })
            video.addEventListener('play', onPlayPause)
            video.addEventListener('pause', onPlayPause)
            video.addEventListener('volumechange', () => {
                muted.value = video.muted
                if (!video.muted) {
                    volume.value = video.volume
                }
            })
            video.addEventListener('durationchange', onTimeUpdate)
            video.addEventListener('enterpictureinpicture', () => { isPiP.value = true })
            video.addEventListener('leavepictureinpicture', () => { isPiP.value = false })
            video.addEventListener('ended', () => {
                if (props.mediaType === 'tv') {
                    ctx.emit('next-episode')
                }
                reportPlayerEvent('complete')
            })

            if (isHls && HlsCtor && HlsCtor.isSupported()) {
                hlsInstance = new HlsCtor({
                    enableWorker: true,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                    maxBufferHole: 0.5,
                    highBufferWatchdogPeriod: 2,
                    appendErrorMaxRetry: 5,
                    // The stream proxy is cold on first hit and can take well
                    // over the 10s hls.js default to serve the master playlist.
                    // Give it a generous timeout and auto-retry with backoff so
                    // the player recovers on its own instead of surfacing a
                    // manifestLoadTimeOut error that needs a manual retry.
                    manifestLoadTimeOut: 60000,
                    manifestLoadingMaxRetry: 5,
                    manifestLoadingRetryDelay: 1500,
                    levelLoadTimeOut: 30000,
                    fragLoadTimeOut: 30000,
                    // Purstream serves long MPEG-TS fragments progressively.
                    // Begin fetching before media attachment and append usable
                    // bytes as they arrive instead of waiting for the whole
                    // ten-second fragment to finish.
                    startFragPrefetch: true,
                    progressive: true,
                })

                await new Promise<void>((resolve, reject) => {
                    let mediaErrorRecoveryRetries = 0
                    let networkErrorRecoveryRetries = 0

                    hlsInstance.on(HlsCtor.Events.ERROR, (_event: any, data: any) => {
                        // NetMirror's alternate audio playlists are MPEG-TS bytes
                        // served with a text/javascript MIME type. HLS.js can still
                        // play the main video, but reports the secondary track load as
                        // fatal. Keep playback alive and let the user choose another
                        // track instead of replacing the player with an error state.
                        if (data.details === 'audioTrackLoadError') {
                            console.warn('[MoovieFrame] ignoring non-fatal audio track load error')
                            buffering.value = false
                            return
                        }
                        if (data.fatal) {
                            console.error('[MoovieFrame] HLS fatal error:', data.type, data.details)
                            if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
                                // A fragment/level/manifest fetch failed mid-playback
                                // (proxy hiccup, segment 5xx, manifest timeout). Retry
                                // the load instead of dropping straight into the Hub
                                // Error overlay after playback already started.
                                if (networkErrorRecoveryRetries < 3) {
                                    networkErrorRecoveryRetries++
                                    console.warn(`[MoovieFrame] Attempting network error recovery for ${data.details} (${networkErrorRecoveryRetries}/3)...`)
                                    try {
                                        hlsInstance.startLoad()
                                    } catch (e) {
                                        console.warn('[MoovieFrame] network recovery startLoad failed:', e)
                                    }
                                    return
                                }
                                console.error('[MoovieFrame] Network error recovery failed after 3 attempts')
                            }
                            if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
                                if (mediaErrorRecoveryRetries < 3) {
                                    mediaErrorRecoveryRetries++
                                    console.warn(`[MoovieFrame] Attempting media error recovery for ${data.details} (${mediaErrorRecoveryRetries}/3)...`)
                                    hlsInstance.recoverMediaError()
                                    return
                                }
                                console.error('[MoovieFrame] Media error recovery failed after 3 attempts')
                            }
                            buffering.value = false
                            if (!firstFrameShown.value && hlsManifestParsed && !componentUnmounted) {
                                // Manifest parsed but no frame ever rendered (e.g. a
                                // poisoned level playlist). Drive the fallback chain
                                // instead of dead-ending on the error overlay.
                                console.warn('[MoovieFrame] HLS attached but never rendered, advancing chain')
                                const failed = lastTriedStream.value
                                error.value = ''
                                loading.value = true
                                destroyPlayer()
                                try { reject(new Error(`HLS fatal: ${data.details}`)) } catch {}
                                if (failed?.url) { void tryFallbackStream(failed) } else { void advanceProviderChain() }
                                return
                            }
                            error.value = `HLS error: ${data.details}`
                            reject(new Error(`HLS fatal: ${data.details}`))
                        }
                    })

                    hlsInstance.on(HlsCtor.Events.MANIFEST_PARSED, () => {
                        hlsManifestParsed = true
                        const levels: { id: number; label: string; height: number }[] = []
                        if (hlsInstance.levels) {
                            for (let i = 0; i < hlsInstance.levels.length; i++) {
                                const l = hlsInstance.levels[i]
                                levels.push({ id: i, label: l.height ? `${l.height}p` : `Level ${i}`, height: l.height || 0 })
                            }
                        }
                        levels.sort((a, b) => b.height - a.height)
                        hlsQualities.value = levels
                        if (levels.length > 0) {
                            hlsInstance.loadLevel = levels[0].id
                            selectedHlsQuality.value = levels[0].id
                        } else {
                            selectedHlsQuality.value = hlsInstance.currentLevel ?? -1
                        }
                        reattachSubtitleSelection()
                        resolve()
                    })

                    hlsInstance.on(HlsCtor.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
                        selectedHlsQuality.value = data.level
                        // HLS.js re-parses subtitle cues on level switches —
                        // re-apply delay/position so embedded subs stay synced.
                        adjustCueStyles()
                    })

                    hlsInstance.on(HlsCtor.Events.AUDIO_TRACKS_UPDATED, () => {
                        const preservedVariants = audioTracks.value.filter(t => (t as any)._catalogId || (t as any)._variantId)
                        audioTracks.value = [
                            ...(hlsInstance.audioTracks || []).map((t: any, i: number) => {
                                const rawName = t.name || t.lang || ''
                                const resolvedName = (!rawName || rawName.toLowerCase() === 'unknown' || rawName.toLowerCase() === 'und')
                                    ? 'English'
                                    : rawName
                                return {
                                    id: i,
                                    name: resolvedName,
                                    lang: t.lang,
                                }
                            }),
                            ...preservedVariants,
                        ]
                        selectedAudioTrack.value = hlsInstance.audioTrack ?? -1
                    })
                    hlsInstance.on(HlsCtor.Events.SUBTITLE_TRACK_LOADED, () => {
                        // Embedded subs arrive asynchronously after the track is
                        // selected. Apply the user's delay/position to the freshly
                        // parsed cues. No mode-toggle re-sync here: hls.js manages
                        // its own track mode and a hidden->showing flip restarts
                        // the active cue display, which itself causes drift.
                        adjustCueStyles()
                    })

                    hlsInstance.on(HlsCtor.Events.SUBTITLE_TRACKS_UPDATED, () => {
                        subtitleTracks.value = [
                            ...(hlsInstance.subtitleTracks || []).map((t: any, i: number) => {
                                const fullName = resolveFullLanguageName(t.name || t.lang);
                                return {
                                    id: i,
                                    name: fullName || `Track ${i}`,
                                    lang: resolveFullLanguageName(t.lang),
                                };
                            }),
                            ...subtitleTracks.value.filter(t => t.id >= OPENSUBS_TRACK_OFFSET),
                        ]
                        if (selectedSubtitleTrack.value < OPENSUBS_TRACK_OFFSET) {
                            // Only adopt hls.js's current selection when it has one —
                            // a fresh instance reports -1 and would clobber the
                            // user's saved HLS track choice on remount.
                            const hlsSel = hlsInstance.subtitleTrack ?? -1
                            if (hlsSel >= 0) selectedSubtitleTrack.value = hlsSel
                        }
                    })

                    hlsInstance.loadSource(url)
                    hlsInstance.attachMedia(video)

                    setTimeout(() => {
                        if (hlsInstance?.levels === undefined && !error.value) {
                            reject(new Error('HLS manifest timeout'))
                        }
                    }, 20000)
                })
            } else {
                video.src = url
                reattachSubtitleSelection()
            }
        }

        /** Re-attach the previously selected subtitle after a remount (quality/
         *  server switch). Blob tracks are destroyed with the old media, so the
         *  OpenSubtitles selection is re-created; HLS tracks re-select by index. */
        function reattachSubtitleSelection() {
            const sel = selectedSubtitleTrack.value
            if (sel === -1) return
            if (sel >= OPENSUBS_TRACK_OFFSET) {
                if (subtitleTracks.value.some(t => t.id === sel)) {
                    nextTick(() => { void selectSubtitleTrack(sel) })
                }
            } else if (hlsInstance && hlsInstance.subtitleTrack !== undefined) {
                nextTick(() => {
                    hlsInstance!.subtitleTrack = sel
                    adjustCueStyles()
                })
            }
        }

        const providers = ref<ProviderStatus[]>([])
        let eventSource: EventSource | null = null

        function buildScrapeUrl(): string {
            const id = String(props.mediaId)
            if (!id) return ''
            const params = new URLSearchParams({ tmdbId: id, type: props.mediaType })
            if (props.title) params.set('title', props.title)
            if (props.season > 0) params.set('season', String(props.season))
            if (props.episode > 0) params.set('episode', String(props.episode))
            params.set('starred', '1')
            params.set('_cb', String(Date.now()))
            const url = `${HUB_BASE}/scrape?${params}`
            console.log('[MOVIEFRAME] buildScrapeUrl:', url, 'season:', props.season, 'episode:', props.episode)
            return url
        }

        function cancelScrape() {
            if (eventSource) { eventSource.close(); eventSource = null }
        }

        function scrapeViaSSE(): Promise<HubStream[]> {
            return new Promise((resolve, reject) => {
                providers.value = []
                activeProviderStatus.value = ''
                const url = buildScrapeUrl()
                if (!url) { reject(new Error('No media ID')); return }
                console.debug('[MoovieFrame][SSE] opening scrape stream', { url, mediaId: props.mediaId, mediaType: props.mediaType })

                const providerMap = new Map<string, ProviderStatus>()
                const providerNames = new Map<string, string>()
                const allStreams: HubStream[] = []
                let resolved = false
                let hasAnyOutput = false

                function finish() {
                    if (resolved) return
                    resolved = true
                    if (eventSource) { eventSource.close(); eventSource = null }
                    if (allStreams.length) {
                        resolve(allStreams)
                    } else {
                        reject(new Error('No streamable sources found'))
                    }
                }

                let sseInitReceived = false
                let sseErrorCount = 0
                // Fail fast if hub is unreachable - prevents infinite loading that looks like Hub Error
                const sseInitTimeout = setTimeout(() => {
                    if (!sseInitReceived && !resolved) {
                        console.warn('[MoovieFrame][SSE] init timeout after 12s - falling back to REST')
                        if (eventSource) { eventSource.close(); eventSource = null }
                        // Let outer catch trigger REST fallback instead of hard reject
                        if (!resolved) { resolved = true; reject(new Error('Hub SSE timeout - trying fallback')) }
                    }
                }, 12000)

                eventSource = new EventSource(url)
                eventSource.onopen = () => console.debug('[MoovieFrame][SSE] connection opened')
                eventSource.onerror = (error) => {
                    sseErrorCount++
                    console.warn('[MoovieFrame][SSE] connection error', {
                        readyState: eventSource?.readyState,
                        error,
                        count: sseErrorCount,
                    })
                    // After 2 consecutive errors and no output, close and fallback to REST
                    if (sseErrorCount >= 2 && !hasAnyOutput && !sseInitReceived) {
                        clearTimeout(sseInitTimeout)
                        if (eventSource) { eventSource.close(); eventSource = null }
                        if (!resolved) { resolved = true; reject(new Error('Hub connection failed')) }
                    }
                    // If we already have streams, don't treat error as fatal - wait for done
                    if (hasAnyOutput && eventSource?.readyState === EventSource.CLOSED) {
                        clearTimeout(sseInitTimeout)
                        finish()
                    }
                }

                const SCRAPER_NAMES: Record<string, string> = {
                    vaplayer: 'Poseidon',
                    'moovie-catalog': 'Athena',
                    streamvault: 'Zeus',
                    vidrift: 'Hades',
                }
                const friendlyProviderName = (id: string) => {
                    const cleanId = id.replace(/^vidsuper-/i, '')
                    return cleanId.charAt(0).toUpperCase() + cleanId.slice(1).replace(/-/g, ' ')
                }

                eventSource.addEventListener('init', (e: MessageEvent) => {
                    sseInitReceived = true
                    sseErrorCount = 0
                    clearTimeout(sseInitTimeout)
                    try {
                        const data = JSON.parse(e.data)
                        console.debug('[MoovieFrame] init sourceIds:', data.sourceIds)
                        const ids: string[] = data.sourceIds || []
                        console.debug('[MoovieFrame][SSE] init received', { sourceIds: ids, sources: data.sources })
                        providerNames.clear()
                        for (const source of (data.sources || [])) {
                            if (source?.id && source?.name) providerNames.set(source.id, source.name)
                        }
                        providerMap.clear()
                        for (const id of ids) {
                            const name = providerNames.get(id) || SCRAPER_NAMES[id] || friendlyProviderName(id)
                            providerMap.set(id, { id, name, status: 'waiting', percentage: 0 })
                        }
                        providers.value = [...providerMap.values()]
                    } catch { /* ignore */ }
                })

                eventSource.addEventListener('start', (e: MessageEvent) => {
                    const id = JSON.parse(e.data)
                    console.debug('[MoovieFrame][SSE] start received', {
                        id,
                        providerKnown: providerMap.has(id),
                        currentLoaderStatus: activeProviderStatus.value,
                    })
                    const ps = providerMap.get(id)
                    if (ps) {
                        ps.status = 'pending'
                        ps.percentage = 0
                        activeProviderStatus.value = `Searching ${ps.name}…`
                        console.debug('[MoovieFrame][loader] after start', {
                            id,
                            provider: ps.name,
                            loaderStatus: activeProviderStatus.value,
                        })
                        providers.value = [...providerMap.values()]
                    }
                })

                eventSource.addEventListener('update', (e: MessageEvent) => {
                    try {
                        const data = JSON.parse(e.data)
                        const ps = providerMap.get(data.id)
                        console.debug('[MoovieFrame][SSE] update received', {
                            id: data.id,
                            status: data.status,
                            percentage: data.percentage,
                            providerKnown: Boolean(ps),
                            loaderStatusBefore: activeProviderStatus.value,
                        })
                        if (ps) {
                            ps.percentage = data.percentage || 0
                            if (data.status) ps.status = data.status
                            if (data.error) ps.error = data.error
                        providers.value = [...providerMap.values()]
                        console.debug('[MoovieFrame][loader] update complete', {
                            loaderStatusAfter: activeProviderStatus.value,
                            providers: providers.value.map((provider) => ({ id: provider.id, status: provider.status, cacheStatus: provider.cacheStatus })),
                        })
                        }
                    } catch { /* ignore */ }
                })

                eventSource.addEventListener('completed', (e: MessageEvent) => {
                    try {
                        const data = JSON.parse(e.data)
                        console.debug('[MoovieFrame] completed event:', data.sourceId, 'keys:', Object.keys(data), 'stream type:', typeof data.stream, 'streams type:', typeof data.streams)
                        if (data.stream) console.debug('[MoovieFrame]  stream keys:', Object.keys(data.stream))
                        if (data.streams) console.debug('[MoovieFrame]  streams length:', data.streams?.length)
                        const ps = providerMap.get(data.sourceId)
                        if (ps) { ps.status = 'success'; providers.value = [...providerMap.values()] }

                        const rawStreams = data.streams || (data.stream ? [data.stream] : [])
                        console.debug('[MoovieFrame] completed:', data.sourceId, 'rawStreams count:', rawStreams.length)
                        for (const mw of rawStreams) {
                            const qualities = mw.qualities || {}
                            const qualityLabels = Object.keys(qualities)
                            const isHls = mw.type === 'hls' || !!mw.playlist

                            if (qualityLabels.length) {
                                for (const qLabel of qualityLabels) {
                                    const entry = qualities[qLabel]
                                    if (!entry) continue
                                    const streamUrl = (entry.playlist || entry.url || '')
                                    if (!streamUrl && !mw.proxyUrl) continue

                                    const stream: HubStream = {
                                        name: mw.name || data.sourceId,
                                        url: streamUrl,
                                        proxyUrl: mw.proxyUrl || '',
                                        quality: qLabel,
                                        type: (entry.type || 'hls') === 'hls' ? 'm3u8' : 'mp4',
                                        headers: mw.headers,
                                        providerName: data.providerName || providerNames.get(data.sourceId) || SCRAPER_NAMES[data.sourceId] || friendlyProviderName(data.sourceId),
                                        providerId: data.sourceId,
                                        proxyMode: normalizeProxyMode(data.proxyMode),
                                        qualities: qualityLabels,
                                    }
                                    if (stream.url?.startsWith('/')) stream.url = HUB_BASE + stream.url
                                    if (stream.proxyUrl?.startsWith('/')) stream.proxyUrl = HUB_BASE + stream.proxyUrl
                                    allStreams.push(stream)
                                    streams.value = [...allStreams]
                                    hasAnyOutput = true
                                    console.debug('[MoovieFrame]  added quality stream:', qLabel, streamUrl.slice(0, 80))
                                }
                            } else {
                                const streamUrl = isHls ? (mw.playlist || '') : (mw.url || '')
                                const stream: HubStream = {
                                    name: mw.name || data.sourceId,
                                    url: streamUrl || '',
                                    proxyUrl: mw.proxyUrl || '',
                                    quality: 'Auto',
                                    type: isHls ? 'm3u8' : (mw.type || 'mp4'),
                                    headers: mw.headers,
                                    providerName: data.providerName || providerNames.get(data.sourceId) || SCRAPER_NAMES[data.sourceId] || friendlyProviderName(data.sourceId),
                                    providerId: data.sourceId,
                                    proxyMode: normalizeProxyMode(data.proxyMode),
                                }
                                if (stream.url?.startsWith('/')) stream.url = HUB_BASE + stream.url
                                if (stream.proxyUrl?.startsWith('/')) stream.proxyUrl = HUB_BASE + stream.proxyUrl
                                if (!stream.url && !stream.proxyUrl) {
                                    console.debug('[MoovieFrame]  skipped empty stream for', data.sourceId)
                                    continue
                                }
                                allStreams.push(stream)
                                streams.value = [...allStreams]
                                hasAnyOutput = true
                                console.debug('[MoovieFrame]  added stream:', stream.name, stream.quality, stream.url?.slice(0, 80))
                            }

                            if (mw._languageVariants && Array.isArray(mw._languageVariants)) {
                                for (const [lvIndex, lv] of (mw._languageVariants as any[]).entries()) {
                                    const provider = lv.provider || 'moovie-catalog'
                                    const catalogId = lv.catalogId || lv.id
                                    const variantId = catalogId
                                        ? `${provider}:${catalogId}`
                                        : `${provider}:direct-${lvIndex}`
                                    const existsInVariants = languageVariants.value.some(v =>
                                        v.id === variantId ||
                                        (v as any).catalogId === catalogId ||
                                        (v.language?.toLowerCase() === lv.language?.toLowerCase() && v.provider === provider)
                                    )
                                    if (!existsInVariants) {
                                        languageVariants.value.push({
                                            language: lv.language,
                                            label: lv.language,
                                            provider,
                                            id: variantId,
                                            catalogId,
                                            type: props.mediaType === 'tv' ? 'show' : 'movie',
                                            season: props.season,
                                            episode: props.episode,
                                            // Pre-resolved variant: play directly with no re-resolution
                                            url: lv.url,
                                            headers: lv.headers,
                                            streamType: lv.type,
                                        } as any)
                                        console.debug('[MoovieFrame]  added language variant from SSE:', provider, lv.language, lv.url ? '(playable directly)' : lv.catalogId)
                                    }
                                }
                                if (languageVariants.value.length > 0) {
                                    const existingHlsTracks = audioTracks.value.filter(t => t.id < 1999)
                                    const englishOriginalTrack = {
                                        id: 1999,
                                        name: 'English (Original)',
                                        lang: 'English',
                                        _isOriginal: true,
                                    }
                                    const variantTracks = languageVariants.value.map((v, i) => ({
                                        id: 2000 + i,
                                        name: v.label || v.language,
                                        lang: v.language,
                                        _variantId: v.id,
                                        _catalogId: (v as any).catalogId || v.id.replace(/^[a-z0-9-]+:/i, '')
                                    }))
                                    audioTracks.value = [...existingHlsTracks, englishOriginalTrack, ...variantTracks]
                                }
                            }
                        }
                        if (!rawStreams.length) {
                            if (ps) { ps.status = 'notfound'; providers.value = [...providerMap.values()] }
                            return
                        }

                        if (!playbackStarted.value) {
                            const best = pickBest(allStreams)
                            if (best) {
                                console.log('[MOVIEFRAME] SSE completed - starting early playback, streams count:', allStreams.length, 'season:', props.season, 'episode:', props.episode)
                                playbackStarted.value = true
                                loading.value = false
                                console.log('[MOVIEFRAME] SSE early playback picked:', best.name, best.quality, 'url:', (best.url || best.proxyUrl || '').slice(0, 100))
                                tryPlayStream(best).catch(() => tryFallbackStream(best))
                            }
                        } else {
                            if (error.value || failedStreamUrls.value.has(originalStream.value?.url || '')) {
                                const untried = allStreams.filter(s => !failedStreamUrls.value.has(s.url))
                                if (untried.length) {
                                    const next = pickBest(untried)
                                    if (next) {
                                        console.log('[MOVIEFRAME] SSE completed - trying fallback stream:', next.name, next.quality)
                                        failedStreamUrls.value.add(next.url)
                                        tryPlayStream(next).catch(() => {})
                                    }
                                }
                            }
                        }
                    } catch { /* ignore */ }
                })

                eventSource.addEventListener('done', () => {
                    clearTimeout(sseInitTimeout)
                    console.log('[MOVIEFRAME] SSE done event - playbackStarted:', playbackStarted.value, 'streams:', allStreams.length)
                    if (!playbackStarted.value && allStreams.length) {
                        playbackStarted.value = true
                        loading.value = false
                        const best = pickBest(allStreams)
                        if (best) {
                            console.log('[MOVIEFRAME] done handler starting playback with:', best.name, best.quality)
                            tryPlayStream(best).catch(() => tryFallbackStream(best))
                        }
                    }
                    if (!playbackStarted.value && !allStreams.length) {
                        finish()
                        return
                    }
                    finish()
                })
                eventSource.addEventListener('noOutput', () => { clearTimeout(sseInitTimeout); if (!hasAnyOutput) finish() })
                eventSource.addEventListener('error', () => { /* keep waiting — reconnect is automatic */ })
            })
        }

        async function fetchStreams(): Promise<HubStream[]> {
            providers.value = []
            cancelScrape()
            try {
                return await scrapeViaSSE()
            } catch (e) {
                console.debug('[MoovieFrame] SSE failed, falling back to REST:', (e as Error).message)
            }
            // Fallback to REST endpoint
            const id = String(props.mediaId)
            if (!id) throw new Error('No media ID')
            const type = props.mediaType
            const qs = `q=${encodeURIComponent(id)}&type=${type}&starred=1${type === 'tv' && props.season > 0 ? `&season=${props.season}` : ''}${type === 'tv' && props.episode > 0 ? `&episode=${props.episode}` : ''}&_cb=${Date.now()}`
            let res: Response | null = null
            let usedUrl = ''
            for (const base of [`${HUB_BASE}/api/search`]) {
                usedUrl = `${base}?${qs}`
                try {
                    const r = await fetch(usedUrl)
                    if (!r.ok) continue
                    if (!r.headers.get('content-type')?.includes('application/json')) continue
                    res = r
                    break
                } catch { /* try next */ }
            }
            if (!res) throw new Error('All hub endpoints failed')
            const text = await res.text()
            let data: any
            try { data = JSON.parse(text) } catch { throw new Error('Hub returned invalid JSON') }
            const all: HubStream[] = []
            for (const group of data.results || []) {
                for (const stream of group.streams || []) {
                    if (stream.proxyUrl?.startsWith('/')) stream.proxyUrl = HUB_BASE + stream.proxyUrl
                    stream.providerName = group.providerName
                    all.push(stream)
                }
            }
            return all
        }

        const qualityRank: Record<string, number> = {
            '4K': 6, '2160P': 6, '2160': 6,
            '1080P': 5, '1080': 5, 'FHD': 5,
            '720P': 4, '720': 4, 'HD': 4,
            '480P': 3, '480': 3, 'SD': 3,
            '360P': 2, '360': 2,
            '240P': 1, '240': 1,
        }

        const providerRank: Record<string, number> = {
            'Poseidon': 3,
            'Athena': 2,
            'Zeus': 1,
            'Hades': 0,
        }

        function scoreStream(s: HubStream): number {
            const q = (s.quality || '').toUpperCase().trim()
            const qRank = qualityRank[q] ?? 0
            const pName = s.providerName || ''
            const pRank = providerRank[pName] ?? 0
            const typeBonus = s.type === 'm3u8' || s.url?.includes('.m3u8') ? 0.5 : 0
            // Quality has highest weight, provider breaks ties, type breaks further ties
            return (qRank * 10) + pRank + typeBonus
        }



        function pickBest(streams: HubStream[]): HubStream | null {
            if (!streams.length) return null
            const targetServer = selectedServer.value
            const filtered = targetServer
                ? streams.filter(s => (s.providerName || '').toLowerCase() === targetServer.toLowerCase())
                : []
            const activeStreams = filtered.length ? filtered : streams
            let best = activeStreams[0]
            let bestScore = scoreStream(best)
            for (let i = 1; i < activeStreams.length; i++) {
                const s = scoreStream(activeStreams[i])
                if (s > bestScore) {
                    bestScore = s
                    best = activeStreams[i]
                }
            }
            return best
        }

        async function doLoad(preservePoseidonRetry = false) {
            console.warn('[MoovieFrame][load-trace] doLoad called', {
                mediaId: props.mediaId,
                mediaType: props.mediaType,
                season: props.season,
                episode: props.episode,
                currentTime: videoRef.value?.currentTime,
                currentSrc: videoRef.value?.currentSrc || videoRef.value?.src || '',
                stack: new Error().stack,
            })
            if (!preservePoseidonRetry) poseidonRefreshAttempts = 0
            originalStream.value = null
            destroyPlayer(); loading.value = true; error.value = ''; playbackStarted.value = false; firstFrameShown.value = false; failedStreamUrls.value = new Set(); streams.value = []
            langVariantFetchKey = '' // reset so variant fetch fires fresh
            try {
                // Only the selected/default source starts immediately; the rest
                // stay idle unless the user picks them in Player settings. If the
                // current provider returns no playable stream, fall through to the
                // next enabled provider automatically.
                const proxySettingPromise = ensureProxySetting()
                const providerList = await loadEnabledProviderList()
                const preferred = selectedServer.value
                    ? providerList.find((provider) => provider.name.toLowerCase() === selectedServer.value.toLowerCase())
                    : undefined
                const ordered = preferred
                    ? [preferred, ...providerList.filter((provider) => provider.id !== preferred.id)]
                    : providerList
                if (!ordered.length) throw new Error('No enabled providers are available')
                selectedServer.value = ordered[0].name
                chainOrdered.value = ordered
                triedProviders.value = new Set<string>()
                await proxySettingPromise
                for (const provider of ordered) {
                    const id = provider.id || provider.name
                    triedProviders.value.add(id.toLowerCase())
                    triedProviders.value.add(provider.name.toLowerCase())
                    const ok = await selectServer(id, { suppressErrors: true })
                    if (ok) {
                        console.debug('[MoovieFrame] successfully playing on:', provider.name)
                        return
                    }
                    console.debug('[MoovieFrame] no playable stream on', provider.name, '- trying next enabled provider')
                }
                throw new Error('All streaming servers failed to resolve a playable source')
            } catch (e: any) {
                console.debug('[MoovieFrame] doLoad error:', e.message)
                if (!playbackStarted.value) {
                    error.value = e.message || 'Failed to load stream'
                }
                loading.value = false
            }
        }

        async function tryProviderChain(all: HubStream[]) {
            // Sort all streams globally: highest quality/score first
            const sorted = [...all].sort((a, b) => scoreStream(b) - scoreStream(a))
            console.log('[MOVIEFRAME] tryProviderChain sorted list:', sorted.map(s => `${s.providerName}-${s.quality}`))
            for (const stream of sorted) {
                try {
                    await tryPlayStream(stream)
                    return
                } catch (e) {
                    console.debug('[MoovieFrame] fallback provider failed:', stream.providerName, stream.quality, (e as Error).message)
                }
            }
            throw new Error('All providers failed')
        }

        async function tryPlayStream(s: HubStream) {
            if (componentUnmounted) throw new Error('Player component was unmounted')
            if (!originalStream.value) {
                originalStream.value = s
            }
            lastTriedStream.value = s
            selectedServer.value = s.providerName || ''
            // Provider-side proxies (emebd / workers.dev / hub / cf) already relay
            // the origin fetch — wrapping them through the hub again adds two extra
            // hops per segment request, so they always play directly.
            // Streamvault / stream-proxy streams work directly and have CORS enabled; never proxy them.
            const isStreamvault = Boolean(
                s.url?.includes('streamvault') ||
                s.url?.includes('/stream-proxy/')
            )
            const alreadyProxied = isStreamvault || Boolean(
                s.url?.startsWith(`${HUB_BASE}/proxy?`) ||
                s.url?.includes('cf-header-hahaevilcraft.site') ||
                /\.workers\.dev\/|\/v1\/proxy\?data=|\/proxy\?data=/.test(s.url || '')
            )
            const proxyMode = normalizeProxyMode(s.proxyMode)
            const forceDirect = proxyMode === 'off' || isStreamvault
            const useProxy = !forceDirect && shouldUseProxy(s) && !!s.proxyUrl && !alreadyProxied
            const isHlsStream = s.type === 'm3u8' || s.type === 'hls'
            async function tryMount(url: string) {
                await Promise.all([
                    mountPlayer(url, isHlsStream),
                    loadOpenSubtitles().catch(() => {}),
                ])
            }
            let playUrl: string
            if (useProxy) {
                playUrl = s.proxyUrl!
                try {
                    await tryMount(playUrl)
                } catch (e) {
                    throw e
                }
            } else if (!forceDirect && shouldUseProxy(s) && s.headers && Object.keys(s.headers).length) {
                // Dashboard "Cloudflare proxy" mode already routes provider streams
                // through our proxies (cf-header-proxy / hub /proxy), embedding the
                // headers as query params. Wrapping an already-wrapped URL nests
                // worker calls and 522s — so play those directly.
                if (alreadyProxied) {
                    playUrl = s.url
                    await tryMount(playUrl)
                } else {
                // If it is Athena (MoovieCatalog) or netmirror, use the VPS proxy instead of Cloudflare Worker
                // because Cloudflare Worker IPs are blocked by netmirror/tv.imgcdn.kim!
                const isAthena = s.providerName?.toLowerCase() === 'mooviecatalog' || 
                                 s.providerName?.toLowerCase() === 'athena' ||
                                 s.name?.toLowerCase() === 'mooviecatalog' ||
                                 s.name?.toLowerCase() === 'athena' ||
                                 s.url?.includes('imgcdn.kim') ||
                                 s.url?.includes('netmirror');
                
                const base64Url = btoa(s.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
                const base64Headers = btoa(JSON.stringify(s.headers)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
                if (isAthena) {
                    playUrl = `${HUB_BASE}/proxy?u=${base64Url}&h=${base64Headers}`
                    await tryMount(playUrl)
                } else {
                    // VPS hub rewrites .m3u8 manifest so segments load through the proxy
                    playUrl = `${HUB_BASE}/proxy?u=${base64Url}&h=${base64Headers}`
                    await tryMount(playUrl)
                }
                }
            } else {
                playUrl = s.url
                try {
                    await tryMount(playUrl)
                } catch (e) {
                    if (s.proxyUrl && !forceDirect && shouldUseProxy(s)) {
                        console.debug('[MoovieFrame] direct playback failed, falling back to proxy:', s.proxyUrl)
                        await tryMount(s.proxyUrl)
                    } else {
                        throw e
                    }
                }
            }
            // Mount succeeded: clear any stale per-provider error (e.g. an
            // earlier "Failed to connect to Poseidon") so the error overlay
            // can't cover a playing video. Later playback errors re-set it.
            error.value = ''
            loading.value = false
        }

        const failedStreamUrls = ref<Set<string>>(new Set())
        async function advanceProviderChain() {
            // Continue past the current provider when its streams all failed
            // after playback already started (doLoad's loop has returned).
            const list = chainOrdered.value
            if (!list.length) {
                error.value = 'No enabled provider returned a playable stream'
                loading.value = false
                return
            }
            const cur = (selectedServer.value || '').toLowerCase()
            const startIdx = list.findIndex(p => (p.name || '').toLowerCase() === cur)
            for (let i = startIdx + 1; i < list.length; i++) {
                const item = list[i]
                const name = item?.name
                const id = item?.id || name
                if (!name || triedProviders.value.has(name.toLowerCase()) || triedProviders.value.has(id.toLowerCase())) continue
                triedProviders.value.add(name.toLowerCase())
                triedProviders.value.add(id.toLowerCase())
                console.log('[MoovieFrame] advancing provider chain to:', name, `(${id})`)
                error.value = ''
                loading.value = true
                activeProviderStatus.value = `Fallback: trying ${name}…`
                try {
                    const ok = await selectServer(id, { suppressErrors: true })
                    if (ok) return
                } catch { /* try next */ }
            }
            error.value = 'No enabled provider returned a playable stream'
            loading.value = false
        }

        async function tryFallbackStream(failed: HubStream) {
            failedStreamUrls.value.add(failed.url)
            const remaining = streams.value.filter(s => !failedStreamUrls.value.has(s.url))
            if (!remaining.length) {
                await advanceProviderChain()
                return
            }
            console.log('[MOVIEFRAME] fallback: trying next stream from', remaining.length, 'remaining')
            const next = pickBest(remaining)
            if (next) {
                console.log('[MOVIEFRAME] fallback: picking', next.name, next.quality)
                try {
                    failedStreamUrls.value.add(next.url)
                    await tryPlayStream(next)
                } catch (e) {
                    console.error('[MOVIEFRAME] fallback also failed:', e)
                    await tryFallbackStream(next)
                }
            }
        }

        async function fetchOpenSubtitles(): Promise<OpenSubtitle[]> {
            const id = String(props.mediaId)
            if (!id) { console.debug('[OpenSubtitles] no mediaId'); return [] }
            const params = new URLSearchParams({ tmdbId: id, type: props.mediaType })
            if (props.mediaType === 'tv' && props.season > 0 && props.episode > 0) {
                params.set('season', String(props.season))
                params.set('episode', String(props.episode))
            }
            const url = `${OPENSUBTITLES_API}?${params}`
            console.debug('[OpenSubtitles] fetching:', url)
            try {
                const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
                if (!resp.ok) { console.debug('[OpenSubtitles] failed', resp.status); return [] }
                const data = await resp.json()
                if (!data.captions || !Array.isArray(data.captions)) return []
                return data.captions as OpenSubtitle[]
            } catch (e) {
                console.debug('[OpenSubtitles] error:', (e as Error).message)
                return []
            }
        }

        async function downloadSubtitleText(subUrl: string, needsProxy: boolean): Promise<string | null> {
            // Helper: fetch a URL's text content, returns null on failure
            async function tryFetch(url: string, timeout = 10000): Promise<string | null> {
                try {
                    const resp = await fetch(url, { signal: AbortSignal.timeout(timeout) })
                    if (!resp.ok) return null
                    return await resp.text()
                } catch {
                    return null
                }
            }

            if (needsProxy) {
                // Race proxy vs direct — first to succeed wins. This avoids sequential
                // 15s+15s worst case; subtitle appears as fast as the faster path.
                let proxyUrl: string
                try {
                    const u = btoa(subUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
                    proxyUrl = `${HUB_BASE}/proxy?u=${u}`
                } catch {
                    proxyUrl = `${HUB_BASE}/proxy?u=${encodeURIComponent(subUrl)}`
                }

                // Race: proxy (8s) vs direct (8s) — first non-null result wins
                const result = await (Promise as any).any([
                    tryFetch(proxyUrl, 8000),
                    tryFetch(subUrl, 8000),
                ]).catch(() => null)

                if (result) return result
                console.warn('[OpenSubtitles] Both proxy and direct fetch failed for:', subUrl)
                return null
            }

            // No proxy needed — direct fetch only
            return tryFetch(subUrl, 10000)
        }

        async function loadOpenSubtitles() {
            if (subsLoading) { console.debug('[OpenSubtitles] already loading, skipping'); return }
            subsLoading = true
            console.debug('[OpenSubtitles] loading subtitle list...')
            const subs = await fetchOpenSubtitles()
            subsLoading = false
            if (!subs.length) { console.debug('[OpenSubtitles] no subtitles found'); return }

            const openTracks = subs.map((sub, i) => {
                const fullName = resolveFullLanguageName(sub.language);
                return {
                    id: OPENSUBS_TRACK_OFFSET + i,
                    name: fullName || `Sub ${i}`,
                    lang: resolveFullLanguageName(sub.language),
                    subUrl: sub.url,
                    needsProxy: sub.needsProxy,
                };
            })

            subtitleTracks.value = [
                ...subtitleTracks.value.filter(t => t.id < OPENSUBS_TRACK_OFFSET),
                ...openTracks,
            ]

            console.debug('[OpenSubtitles]', openTracks.length, 'tracks available')
        }

        function retry() { void doLoad() }

        function onClickOutside(e: MouseEvent) {
            const target = e.target as Node
            if (volumeSliderOpen.value) {
                const volBtn = rootRef.value?.querySelector('.moovie-frame__volume-control')
                if (volBtn && !volBtn.contains(target)) {
                    volumeSliderOpen.value = false
                }
            }
            if (qualityOpen.value && !qualityRootRef.value?.contains(target)) {
                qualityOpen.value = false
            }
            if (settingsOpen.value) {
                const panel = rootRef.value?.querySelector('.moovie-frame__settings-panel')
                const btn = rootRef.value?.querySelector('.moovie-frame__three-dot-btn')
                if (panel && !panel.contains(target) && btn && !btn.contains(target)) {
                    settingsOpen.value = false
                    settingsSection.value = null
                }
            }
            if (mobileServersOpen.value) {
                const wrap = rootRef.value?.querySelector('.moovie-frame__mobile-server-btn-wrap')
                if (wrap && !wrap.contains(target)) {
                    mobileServersOpen.value = false
                }
            }
        }

        async function selectQuality(index: number) {
            const q = uniqueQualities.value[index]
            if (!q) return
            // Find the stream in the active server's pool first, then fall back globally
            const pool = activeServerStreams.value
            const poolIdx = pool.findIndex(s => s.quality === q)
            const stream = poolIdx >= 0 ? pool[poolIdx] : streams.value.find(s => s.quality === q)
            if (!stream) return
            const globalIdx = streams.value.indexOf(stream)
            qualityOpen.value = false
            settingsOpen.value = false
            settingsSection.value = null
            selectedStreamIndex.value = globalIdx >= 0 ? globalIdx : 0
            await tryPlayStream(stream)
        }

        async function selectServer(provider: string, opts?: { suppressErrors?: boolean }): Promise<boolean> {
            selectedServer.value = provider
            if (!opts?.suppressErrors) triedProviders.value.clear()
            settingsOpen.value = false
            settingsSection.value = null

            const providerObj = providers.value.find(p => (p.name || '').toLowerCase() === provider.toLowerCase() || (p.id || '').toLowerCase() === provider.toLowerCase())
            const serverId = providerObj?.id || provider
            const serverName = providerObj?.name || provider

            const video = videoRef.value
            if (video) video.pause()
            playing.value = false
            loading.value = true
            error.value = ''
            firstFrameShown.value = false
            activeProviderStatus.value = `Connecting to ${serverName}…`

            if (providerObj) {
                providerObj.status = 'pending'
                providerObj.percentage = 0
            }

            try {
                const id = String(props.mediaId)
                const isAnime = (props.mediaType as string) === 'anime' || Boolean(props.title && /anime/i.test(props.title))
                const query = new URLSearchParams({
                    server: serverId,
                    tmdbId: id,
                    type: isAnime ? 'anime' : (props.mediaType === 'tv' ? 'tv' : 'movie'),
                    title: props.title || '',
                    audio: currentAudioMode.value || 'sub',
                })
                if (props.season > 0) query.set('season', String(props.season))
                if (props.episode > 0) query.set('episode', String(props.episode))
                if (props.anilistId) query.set('anilistId', String(props.anilistId))

                const ctrl = new AbortController()
                const timeout = setTimeout(() => ctrl.abort(), 12000)
                const res = await fetch(`/api/stream/resolve?${query}`, { signal: ctrl.signal })
                clearTimeout(timeout)

                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data = await res.json()

                if (data && data.success && data.streamUrl) {
                    if (providerObj) {
                        providerObj.status = 'success'
                        providerObj.percentage = 100
                    }

                    // Map subtitles if available
                    if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
                        const newTracks = data.subtitles.map((sub: any, idx: number) => ({
                            id: OPENSUBS_TRACK_OFFSET + idx,
                            name: sub.label || sub.lang || `Subtitle ${idx + 1}`,
                            lang: sub.lang || 'en',
                            subUrl: sub.url,
                            needsProxy: false,
                        }))
                        subtitleTracks.value = [
                            ...subtitleTracks.value.filter(t => t.id < OPENSUBS_TRACK_OFFSET),
                            ...newTracks,
                        ]
                    }

                    const hubStream: HubStream = {
                        name: data.serverName || serverName,
                        url: data.streamUrl,
                        proxyUrl: '',
                        quality: data.quality || 'Auto',
                        type: data.mode === 'hls' ? 'm3u8' : 'mp4',
                        providerName: serverName,
                        providerId: serverId,
                    }
                    streams.value = [hubStream]
                    selectedStreamIndex.value = 0

                    await tryPlayStream(hubStream)
                    loading.value = false
                    playbackStarted.value = true
                    return true
                } else {
                    if (providerObj) {
                        providerObj.status = 'failure'
                        providerObj.percentage = 100
                    }
                    if (!opts?.suppressErrors) {
                        error.value = data?.message || `No playable stream on ${serverName}`
                    }
                    return false
                }
            } catch (err: any) {
                console.warn('[MoovieFrame] selectServer failed:', serverName, err.message)
                if (providerObj) {
                    providerObj.status = 'failure'
                    providerObj.percentage = 100
                }
                if (!opts?.suppressErrors) {
                    error.value = `Failed to connect to ${serverName}`
                }
                return false
            }
        }

        async function selectAudioTrack(index: number) {
            selectedAudioTrack.value = index

            if (index === 1999) {
                if (originalStream.value) {
                    buffering.value = true
                    await tryPlayStream(originalStream.value)
                }
                return
            }

            // HLS native audio track switch (e.g. dubbed HLS streams)
            if (hlsInstance && hlsInstance.audioTrack !== undefined && index < 1999) {
                hlsInstance.audioTrack = index
                return
            }

            // Language variant resolve (smov-style multi-provider)
            const track = audioTracks.value.find(t => t.id === index)
            if (!track) return
            const variantId = (track as any)?._variantId || (track as any)?._catalogId
            if (!variantId) return

            const lv = languageVariants.value.find(v => 
                v.id === variantId || 
                (v as any).catalogId === variantId || 
                v.id.endsWith(`:${variantId}`) ||
                variantId.endsWith(`:${(v as any).catalogId}`)
            )
            if (!lv) {
                console.warn('[MoovieFrame] selectAudioTrack: variant not found for', variantId)
                return
            }

            // Pre-resolved variant (Shankar resolves every language at scrape time):
            // play the cached direct URL, no re-resolution round-trip.
            if (lv.url) {
                console.debug('[MoovieFrame] selectAudioTrack: playing pre-resolved', lv.label, lv.url.slice(0, 80))
                buffering.value = true
                const s: HubStream = {
                    name: lv.label,
                    url: lv.url,
                    proxyUrl: '',
                    quality: 'Auto',
                    type: lv.streamType === 'm3u8' ? 'm3u8' : 'mp4',
                    headers: lv.headers,
                    providerName: lv.provider,
                }
                await tryPlayStream(s)
                return
            }

            console.debug('[MoovieFrame] selectAudioTrack: resolving variant', lv.id, 'type:', lv.type)
            buffering.value = true

            const resolved = await resolveLanguageVariantUrl(
                lv.id,
                lv.type,
                lv.season,
                lv.episode
            )
            if (!resolved?.url) {
                console.warn('[MoovieFrame] selectAudioTrack: could not resolve variant URL for', lv.id)
                buffering.value = false
                return
            }

            console.debug('[MoovieFrame] selectAudioTrack: playing', lv.label, resolved.url.slice(0, 80))
            const s: HubStream = {
                name: lv.label,
                url: resolved.url,
                proxyUrl: resolved.proxyUrl || '',
                quality: 'Auto',
                type: resolved.type,
                headers: resolved.headers,
                providerName: lv.provider,
            }
            await tryPlayStream(s)
        }

        /** Fetch language variants from all providers (smov logic) and populate audioTracks */
        async function triggerLanguageVariantFetch() {
            if (!props.mediaId || !props.title) return

            const key = `${props.mediaId}-${props.mediaType}-${props.season ?? 0}-${props.episode ?? 0}`
            if (langVariantFetchKey === key) return
            langVariantFetchKey = key

            console.debug('[MoovieFrame] triggerLanguageVariantFetch: fetching for', props.title, props.mediaType, props.mediaId)

            const variants = await fetchLanguageVariantsFromHub(
                props.title,
                props.mediaType === 'tv' ? 'show' : 'movie',
                props.mediaId,
                props.mediaType === 'tv' ? props.season : undefined,
                props.mediaType === 'tv' ? props.episode : undefined
            )

            if (langVariantFetchKey !== key) return  // stale — props changed

            console.debug('[MoovieFrame] triggerLanguageVariantFetch: got', variants.length, 'variants')
            
            for (const v of variants) {
                const exists = languageVariants.value.some(existing => existing.id === v.id || (existing as any).catalogId === (v as any).catalogId || (existing.language?.toLowerCase() === v.language?.toLowerCase() && existing.provider === v.provider))
                if (!exists) {
                    languageVariants.value.push(v)
                }
            }

            if (languageVariants.value.length > 0) {
                const existingHlsTracks = audioTracks.value.filter(t => t.id < 1999)
                const englishOriginalTrack = {
                    id: 1999,
                    name: 'English (Original)',
                    lang: 'English',
                    _isOriginal: true,
                }
                const variantTracks = languageVariants.value.map((v, i) => ({
                    id: 2000 + i,
                    name: v.label || v.language,
                    lang: v.language,
                    _variantId: v.id,
                    _catalogId: (v as any).catalogId || v.id.replace(/^[a-z0-9-]+:/i, '')
                }))
                audioTracks.value = [...existingHlsTracks, englishOriginalTrack, ...variantTracks]
            }
        }

        // Kept as compatibility helpers for older integrations, but never
        // invoked automatically. Initial playback and fallback are single
        // provider operations now.
        void buildScrapeUrl
        void scrapeViaSSE
        void fetchStreams
        void tryProviderChain
        void triggerLanguageVariantFetch

        async function selectSubtitleTrack(index: number) {
            selectedSubtitleTrack.value = index
            if (index === -1) {
                if (hlsInstance && hlsInstance.subtitleTrack !== undefined) {
                    hlsInstance.subtitleTrack = -1
                }
                activeCueText.value = ''
                return
            }
            if (index >= OPENSUBS_TRACK_OFFSET) {
                if (hlsInstance && hlsInstance.subtitleTrack !== undefined) {
                    hlsInstance.subtitleTrack = -1
                }
                const trackMeta = subtitleTracks.value.find(t => t.id === index)
                if (!trackMeta?.subUrl) { console.debug('[OpenSubtitles] no subUrl for track', index); return }
                let cues = osSubCues.get(index)
                if (!cues) {
                    console.debug('[OpenSubtitles] lazy-loading sub:', trackMeta.name)
                    const text = await downloadSubtitleText(trackMeta.subUrl, !!trackMeta.needsProxy)
                    if (!text) { console.debug('[OpenSubtitles] failed to load sub'); return }
                    cues = parseSubtitleCues(srtToVtt(text))
                    osSubCues.set(index, cues)
                }
                updateActiveCueText()
            } else {
                if (hlsInstance && hlsInstance.subtitleTrack !== undefined) {
                    hlsInstance.subtitleTrack = index
                }
                nextTick(() => {
                    adjustCueStyles()
                })
            }
        }

        function toggleSubtitles() {
            if (selectedSubtitleTrack.value !== -1) {
                void selectSubtitleTrack(-1)
                return
            }

            // Prefer English whenever captions are enabled. Track names from HLS
            // and OpenSubtitles vary (English, en, eng, English (US), etc.), so
            // match both the language code and the display label before falling
            // back to the first available track.
            const englishTrack = subtitleTracks.value.find(track => {
                const name = (track.name || '').toLowerCase()
                const lang = (track.lang || '').toLowerCase()
                return name.includes('english') || /^(en|eng)([-_]|$)/.test(lang)
            })
            const trackToEnable = englishTrack || subtitleTracks.value[0]
            if (trackToEnable) void selectSubtitleTrack(trackToEnable.id)
        }


        function selectHlsQuality(index: number) {
            selectedHlsQuality.value = index
            settingsOpen.value = false
            settingsSection.value = null
            if (hlsInstance && hlsInstance.loadLevel !== undefined) {
                hlsInstance.loadLevel = index
            }
        }

        function togglePlay() {
            const video = videoRef.value
            if (!video) return
            if (video.paused) {
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768
                if (isMobile && !document.fullscreenElement) {
                    const el = rootRef.value
                    if (el) {
                        el.requestFullscreen().catch((e) => console.warn('[MoovieFrame] auto-fullscreen failed:', e.message))
                    }
                }
                video.play().catch(() => {})
            } else {
                video.pause()
            }
        }

        function toggleMute() {
            const video = videoRef.value
            if (!video) return
            video.muted = !video.muted
            muted.value = video.muted
        }

        function toggleFullscreen() {
            const el = rootRef.value
            if (!el) return
            if (document.fullscreenElement) {
                document.exitFullscreen()
            } else {
                el.requestFullscreen().catch((e) => console.warn('[MoovieFrame] fullscreen failed:', e.message, e))
            }
        }

        function formatTime(t: number): string {
            if (!t || !isFinite(t)) return '0:00'
            const m = Math.floor(t / 60)
            const s = Math.floor(t % 60)
            return `${m}:${s.toString().padStart(2, '0')}`
        }

        function seek(e: Event) {
            const video = videoRef.value
            if (!video) return
            const val = parseFloat((e.target as HTMLInputElement).value)
            if (!isFinite(val)) return
            console.debug('[MoovieFrame][seek-trace] seekbar input', {
                from: video.currentTime,
                to: val,
                src: video.currentSrc || video.src || '',
            })
            currentTime.value = val
            video.currentTime = val
        }

        function seekBy(seconds: number) {
            const video = videoRef.value
            if (!video || !isFinite(video.duration)) return
            const target = Math.max(0, Math.min(video.duration, video.currentTime + seconds))
            console.debug('[MoovieFrame][seek-trace] relative seek', {
                seconds,
                from: video.currentTime,
                to: target,
                src: video.currentSrc || video.src || '',
            })
            currentTime.value = target
            video.currentTime = target
        }

        function setPlaybackSpeed(speed: number) {
            playbackSpeed.value = speed
            settingsSection.value = null
            if (videoRef.value) videoRef.value.playbackRate = speed
        }

        function togglePiP() {
            const video = videoRef.value
            if (!video) return
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture()
            } else {
                video.requestPictureInPicture().catch(() => {})
            }
        }

        function startTrackingIfNeeded() {
            if (stopTracking) { stopTracking(); stopTracking = null }
            if (props.mediaId) {
                stopTracking = startProgressTracking(props.mediaId, props.mediaType, props.mediaType === 'tv' ? props.season : undefined, props.mediaType === 'tv' ? props.episode : undefined)
            }
        }

        let autoDownloaded = false
        watch(() => streams.value, (newStreams) => {
            if (newStreams && newStreams.length && !autoDownloaded && window.location.search.includes('download=1')) {
                autoDownloaded = true
                setTimeout(() => {
                    handleDownloadMedia()
                }, 800)
            }
        }, { immediate: true })

        watch(() => [props.season, props.episode], (newVals, oldVals) => {
            const newS = newVals[0], newE = newVals[1]
            const oldS = oldVals?.[0], oldE = oldVals?.[1]
            console.warn('[MoovieFrame][load-trace] season/episode watcher fired', {
                oldSeason: oldS,
                newSeason: newS,
                oldEpisode: oldE,
                newEpisode: newE,
                mediaId: props.mediaId,
                currentTime: videoRef.value?.currentTime,
                stack: new Error().stack,
            })
            if (newS !== oldS || newE !== oldE) {
                subtitleTracks.value = []
                selectedSubtitleTrack.value = -1
                osSubCues.clear()
                activeCueText.value = ''
            }
            if (props.mediaId) {
                console.log('[MOVIEFRAME] watcher calling doLoad()')
                void doLoad();
                startTrackingIfNeeded();
            }
        })

        function changeVolume(delta: number) {
            const video = videoRef.value;
            if (!video) return;
            const nextVol = Math.min(1, Math.max(0, volume.value + delta));
            video.volume = nextVol;
            volume.value = nextVol;
            if (nextVol > 0) {
                video.muted = false;
                muted.value = false;
            } else {
                video.muted = true;
                muted.value = true;
            }
        }

        function onKeydown(e: KeyboardEvent) {
            const tag = (e.target as HTMLElement)?.tagName
            const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
            if (isEditable) return

            const k = e.key
            if (k === ' ' || k === 'Spacebar' || k === 'k' || k === 'K') {
                e.preventDefault();
                togglePlay();
            } else if (k === 'ArrowRight' || k === 'l' || k === 'L') {
                e.preventDefault();
                seekBy(5);
            } else if (k === 'ArrowLeft' || k === 'j' || k === 'J') {
                e.preventDefault();
                seekBy(-5);
            } else if (k === 'ArrowUp') {
                e.preventDefault();
                changeVolume(0.1);
            } else if (k === 'ArrowDown') {
                e.preventDefault();
                changeVolume(-0.1);
            } else if (k === 'f' || k === 'F') {
                e.preventDefault();
                toggleFullscreen();
            } else if (k === 'm' || k === 'M') {
                e.preventDefault();
                toggleMute();
            }
        }

        function onFullscreenChange() { isFullscreen.value = !!document.fullscreenElement }

        let heartbeatInterval: any = null;
        let cueTimer: any = null;

        onMounted(async () => {
            componentUnmounted = false
            await loadServerOverrides()
            if (props.mediaId && !props.autoEmbed) {
                if (activeEmbedId.value === 'native') {
                    console.log('[MOVIEFRAME] mounted: starting selected single-source scrape')
                    void doLoad()
                } else {
                    // Default server is an embed (e.g. FilmU): open it directly.
                    console.log('[MOVIEFRAME] mounted: opening default embed', activeEmbedId.value)
                    embedOpen.value = true
                    settingsOpen.value = false
                    ctx.emit('embed-change', true)
                    if (!paneSrc[activeEmbedId.value]) {
                        paneSrc[activeEmbedId.value] = embedUrls.value[activeEmbedId.value] || ''
                    }
                }
            }
            if (props.autoEmbed) {
                embedOpen.value = true
                settingsOpen.value = false
                ctx.emit('embed-change', true)
                console.log('[MOVIEFRAME] mounted: auto-embed mode active')
                if (activeEmbedId.value === 'native') {
                    void doLoad()
                }
            }
            startTrackingIfNeeded()
            if (videoRef.value) {
                volume.value = videoRef.value.volume
            }
            document.addEventListener('click', onClickOutside)
            document.addEventListener('fullscreenchange', onFullscreenChange)
            document.addEventListener('keydown', onKeydown)
            window.addEventListener('message', handleParentMessage)
            const root = rootRef.value
            if (root) {
                root.addEventListener('mousemove', resetIdleTimer)
                root.addEventListener('touchstart', resetIdleTimer)
                root.addEventListener('mouseleave', handleMouseLeave)
            }
            // Fallback: catch pointer movement even when iframe swallows events inside the player
            document.addEventListener('pointermove', resetIdleTimer, { passive: true })
            resetIdleTimer()
 
            // Heartbeat sync timer (every 3 seconds)
            heartbeatInterval = setInterval(() => {
                if (playing.value) {
                    reportPlayerEvent('heartbeat');
                }
            }, 3000);

            // Report ready event for watchtogether playback sync on mount
            setTimeout(() => {
                reportPlayerEvent('ready');
            }, 100);

            cueTimer = setInterval(() => {
                adjustCueStyles()
            }, 1000);
        })

        watch(subtitlePosition, () => {
            nextTick(() => adjustCueStyles())
        })

        onUnmounted(() => {
            componentUnmounted = true
            clearAllEmbedPanes()
            if (prewarmTimer) clearTimeout(prewarmTimer)
            if (idleTimer) clearTimeout(idleTimer)
            if (heartbeatInterval) clearInterval(heartbeatInterval)
            if (cueTimer) clearInterval(cueTimer)
            if (smoothSeekTimer) clearInterval(smoothSeekTimer)
            cancelScrape()
            activeSourceEventSource?.close()
            activeSourceEventSource = null
            destroyPlayer()
            if (stopTracking) { stopTracking(); stopTracking = null }
            document.removeEventListener('click', onClickOutside)
            document.removeEventListener('fullscreenchange', onFullscreenChange)
            document.removeEventListener('keydown', onKeydown)
            document.removeEventListener('pointermove', resetIdleTimer)
            window.removeEventListener('message', handleParentMessage)
            const root = rootRef.value
            if (root) {
                root.removeEventListener('mousemove', resetIdleTimer)
                root.removeEventListener('touchstart', resetIdleTimer)
                root.removeEventListener('mouseleave', handleMouseLeave)
            }
            if (typeof document !== 'undefined') {
                document.documentElement.style.overflow = ''
                document.body.style.overflow = ''
            }
        })

        return { rootRef, videoRef, qualityRootRef, loading, error, activeProviderName, activeProviderStatus, providers, streams, uniqueQualities, selectedQualityIndex, activeQualityLabel, hlsQualities, hlsQualityLabel, selectedHlsQuality, qualityOpen, buffering, seeking, retry, selectQuality, settingsOpen, settingsSection, selectedServer, availableServers, audioTracks, selectedAudioTrack, currentAudioLabel, subtitleTracks, selectedSubtitleTrack, currentSubtitleLabel, osSubActive, selectServer, selectAudioTrack, selectSubtitleTrack, toggleSubtitles, selectHlsQuality, playing, currentTime, duration, muted, playbackSpeed, isPiP, isFullscreen, playbackStarted, PLAYBACK_SPEEDS, togglePlay, toggleMute, toggleFullscreen, formatTime, seek, seekBy, setPlaybackSpeed, togglePiP, handleCastToTV, handleDownloadMedia, loadOpenSubtitles, controlsHidden, isHoveringControls, resetIdleTimer, subtitleDelay, subtitleBgOpacity, subtitleTextOpacity, subtitleFontSize, subtitlePosition, changeSubtitleDelay, resetSubtitleDelay, brandText, moveSubtitles, volumeSliderOpen, volume, onVolumeChange, handleVolumeButtonClick, activeCueText, activeCueTextFormatted, embedOpen, embedUrl, toggleEmbedMode, paneSrc, embedLoading, onEmbedLoaded, embedSources, activeEmbedId, switchEmbed, handleMouseLeave, embedSourcesIdle, mobileServersOpen, activeServerLabel, toggleMobileServers, selectMobileServer, changeAudioMode, currentAudioMode }
    },
})
</script>

<style scoped lang="scss" src="@/assets/css/moovie-frame.scss"></style>
