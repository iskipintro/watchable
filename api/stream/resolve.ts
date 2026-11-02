import crypto from "crypto";
import vm from "vm";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";

const VPS_ORIGIN = "https://hahaevilcraft.site";

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function vpsProxyUrl(rawUrl: string, headers?: Record<string, string>): string {
  if (!rawUrl) return rawUrl;

  if (rawUrl.startsWith(`${VPS_ORIGIN}/proxy?`)) return rawUrl;

  if (rawUrl.startsWith("/proxy?") || rawUrl.startsWith("/api/stream/proxy?")) {
    const parsed = new URL(rawUrl, VPS_ORIGIN);
    const target = parsed.searchParams.get("url");
    if (!target) return `${VPS_ORIGIN}${rawUrl}`;

    const merged: Record<string, string> = { ...(headers || {}) };
    const referer = parsed.searchParams.get("referer");
    const origin = parsed.searchParams.get("origin");
    if (referer && !merged.Referer && !merged.referer) merged.Referer = referer;
    if (origin && !merged.Origin && !merged.origin) merged.Origin = origin;

    return vpsProxyUrl(target, merged);
  }

  if (rawUrl.startsWith(`${VPS_ORIGIN}/api/stream/proxy?`)) {
    return vpsProxyUrl(rawUrl.slice(VPS_ORIGIN.length), headers);
  }

  if (!isAbsoluteHttpUrl(rawUrl)) return rawUrl;

  const u = toBase64Url(rawUrl);
  const headerEntries = headers
    ? Object.entries(headers).filter(([, value]) => typeof value === "string" && value)
    : [];
  if (!headerEntries.length) return `${VPS_ORIGIN}/proxy?u=${u}`;

  const h = toBase64Url(JSON.stringify(Object.fromEntries(headerEntries)));
  return `${VPS_ORIGIN}/proxy?u=${u}&h=${h}`;
}

function routeStreamDataThroughVps(data: any): any {
  if (!data || typeof data !== "object") return data;

  const baseHeaders =
    data.headers && typeof data.headers === "object" ? data.headers : undefined;

  if (typeof data.streamUrl === "string") {
    data.streamUrl = vpsProxyUrl(data.streamUrl, baseHeaders);
  }

  if (Array.isArray(data.subtitles)) {
    for (const sub of data.subtitles) {
      if (!sub || typeof sub !== "object") continue;
      const subHeaders =
        sub.headers && typeof sub.headers === "object" ? sub.headers : baseHeaders;
      if (typeof sub.url === "string") sub.url = vpsProxyUrl(sub.url, subHeaders);
      if (typeof sub.file === "string") sub.file = vpsProxyUrl(sub.file, subHeaders);
    }
  }

  return data;
}

function routeResultThroughVps(result: any): any {
  if (result && typeof result === "object" && result.data) {
    routeStreamDataThroughVps(result.data);
  }
  return result;
}

// api/stream/resolve.ts


// src/lib/streaming/streaming.ts
var ALL_STREAM_SERVERS = [
  // ─── 1. Prioritized Movies & Series Servers (Checked First) ───
  {
    id: "poseidon",
    name: "Itachi",
    badge: "Fast Stream",
    category: "general",
    desc: "Lightning-fast direct Cloudflare Edge CDN stream with zero buffering",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "vixsrc_hls",
    name: "Obito",
    badge: "Multi-Audio",
    category: "general",
    desc: "Direct native stream with multiple audio tracks",
    isNativeHLS: true,
    supportsDualAudio: true,
    getMovieUrl: (id) => `https://movienig.ht/watch/movie/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://movienig.ht/watch/tv/${id}/${s}/${e}`
  },
  {
    id: "salem_hls",
    name: "Madara",
    badge: "Direct Stream",
    category: "general",
    desc: "Lightning-fast direct native stream (<300ms)",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://movienig.ht/watch/movie/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://movienig.ht/watch/tv/${id}/${s}/${e}`
  },
  {
    id: "movienight_auto",
    name: "Minato",
    badge: "Multi-Audio",
    category: "general",
    desc: "Direct native stream with auto-failover across global nodes",
    isNativeHLS: true,
    supportsDualAudio: true,
    getMovieUrl: (id) => `https://movienig.ht/watch/movie/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://movienig.ht/watch/tv/${id}/${s}/${e}`
  },
  {
    id: "shiopa_hls",
    name: "Eren",
    badge: "Direct Stream",
    category: "general",
    desc: "Lightning-fast direct stream (<300ms)",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "cinejoy_nebula",
    name: "Mikasa",
    badge: "Subtitles",
    category: "general",
    desc: "Direct stream with multi-language captions",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "stellar_hls",
    name: "Aomine",
    badge: "4K UHD Master",
    category: "general",
    desc: "CineBros direct 4K/1080p HLS stream with multi-language subtitle tracks",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://stellar.gdn/watch/movie/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://stellar.gdn/watch/tv/${id}?s=${s}&e=${e}`
  },
  {
    id: "stellar_miami",
    name: "Sukuna",
    badge: "Fast Stream",
    category: "general",
    desc: "Ultra-fast direct native stream",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://stellar.gdn/watch/movie/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://stellar.gdn/watch/tv/${id}?s=${s}&e=${e}`
  },
  {
    id: "orion",
    name: "Kakashi",
    badge: "Multi-Audio",
    category: "general",
    desc: "Stream with Hindi, Spanish, and English multi-audio tracks + VTT subtitles",
    isNativeHLS: true,
    supportsDualAudio: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "purstream",
    name: "Sasuke",
    badge: "Direct Stream",
    category: "general",
    desc: "Direct fast stream",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "atlantia",
    name: "Tanjiro",
    badge: "Multi-Audio",
    category: "general",
    desc: "Direct native stream gateway with auto-failover",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "rive_vanguard",
    name: "L",
    badge: "4K UHD Master",
    category: "general",
    desc: "Rivestream Vanguard high-bitrate 1080p / 4K UHD Master stream",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "rive_citadel",
    name: "Luffy",
    badge: "Multi-Audio",
    category: "general",
    desc: "Direct native stream with multi-language audio and WebVTT captions",
    isNativeHLS: true,
    supportsDualAudio: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "cinejoy_hls",
    name: "Hashirama",
    badge: "Direct Stream",
    category: "general",
    desc: "Lightning-fast direct native stream",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "cinejoy_lisbon",
    name: "Naruto",
    badge: "Fast Stream",
    category: "general",
    desc: "Ultra-fast direct native stream",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "vidzee",
    name: "Killua",
    badge: "Direct Stream",
    category: "general",
    desc: "Lightning-fast direct native stream",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  // ─── 2. Prioritized Anime Servers (Dual Audio Dub & Sub) ───
  {
    id: "miruro_anime",
    name: "Shisui",
    badge: "Dub & Sub",
    category: "anime",
    desc: "Lightning-fast direct native streams with English Dub and Subtitles",
    isNativeHLS: true,
    supportsDualAudio: true,
    getMovieUrl: (id, title) => `https://barelystarted.miruro.tv/search?q=${encodeURIComponent(title || String(id))}`,
    getTVUrl: (id, _s = 1, _e = 1, title) => `https://barelystarted.miruro.tv/search?q=${encodeURIComponent(title || String(id))}`
  },
  {
    id: "kaa_anime",
    name: "Yuji",
    badge: "Dub & Sub",
    category: "anime",
    desc: "Direct native stream with both Japanese audio and English Dub",
    isNativeHLS: true,
    supportsDualAudio: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "kazo_anime",
    name: "Female Titan",
    badge: "Dub & Sub",
    category: "anime",
    desc: "Kazora Female Titan cluster stream with OP/ED skip intervals & 8+ subtitle tracks",
    isNativeHLS: true,
    supportsDualAudio: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "kyoo_anime",
    name: "Toji",
    badge: "Dual Audio",
    category: "anime",
    desc: "Kazora Toji cluster stream with dual audio",
    isNativeHLS: true,
    supportsDualAudio: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "juju_anime",
    name: "Levi",
    badge: "Multi-Sub",
    category: "anime",
    desc: "Kazora Levi cluster stream with multi-language subtitle tracks",
    isNativeHLS: true,
    supportsDualAudio: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "lufi_anime",
    name: "Goku",
    badge: "Dub & Sub",
    category: "anime",
    desc: "Kazora Goku cluster stream with Dub & Sub",
    isNativeHLS: true,
    supportsDualAudio: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "poseidon_anime",
    name: "Itachi Anime",
    badge: "Sub Only",
    category: "anime",
    desc: "Ultra-fast direct stream with zero buffering for anime series and films (Japanese Sub)",
    isNativeHLS: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "orion_anime",
    name: "Tengen",
    badge: "Multi-Audio",
    category: "anime",
    desc: "Multi-audio anime streams with English Dub, Japanese Sub, and Spanish audio",
    isNativeHLS: true,
    supportsDualAudio: true,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  },
  {
    id: "animeparadise",
    name: "AnimeParadise",
    badge: "Crunchyroll",
    category: "anime",
    desc: "Crunchyroll raw master stream with clean subtitles and built-in OP/ED skip intervals",
    isNativeHLS: true,
    supportsDualAudio: false,
    getMovieUrl: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    getTVUrl: (id, s = 1, e = 1) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`
  }
];

// src/lib/streaming/cinejoy.ts

var cachedApiPromise = null;
async function initCinejoyApi() {
  try {
    const res = await fetch("https://cinejoy.pk/_app/immutable/chunks/DHJgaGwg.js", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://cinejoy.pk/"
      },
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return null;
    const code = await res.text();
    const icIdx = code.indexOf("function ic(");
    if (icIdx === -1) return null;
    const nextFnAfterIc = code.indexOf("function ", icIdx + 500);
    const mIdx = code.indexOf("function M(){");
    if (mIdx === -1) return null;
    const sliceCode = code.slice(mIdx, nextFnAfterIc !== -1 ? nextFnAfterIc : icIdx + 5e3);
    const sandbox = {
      console,
      fetch: (url, opts = {}) => {
        const headers = {
          Referer: "https://cinejoy.pk/",
          Origin: "https://cinejoy.pk",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          ...opts.headers || {}
        };
        return fetch(url, { ...opts, headers });
      },
      Headers,
      Request,
      Response,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      Uint8Array,
      ArrayBuffer,
      WebAssembly,
      crypto: globalThis.crypto,
      Intl,
      setTimeout,
      clearTimeout
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    const fullCode = "const B = { subtitles: [], languages: [] };" + sliceCode + "globalThis.__API__ = { GW, pW, qW };";
    const ctx = vm.createContext(sandbox);
    vm.runInContext(fullCode, ctx);
    return sandbox.__API__ || null;
  } catch (err) {
    console.error("[Cinejoy] Failed to initialize scraper engine:", err);
    return null;
  }
}
async function getCinejoyApi() {
  if (!cachedApiPromise) {
    cachedApiPromise = initCinejoyApi().then((api) => {
      if (!api) cachedApiPromise = null;
      return api;
    }).catch((_err) => {
      cachedApiPromise = null;
      return null;
    });
  }
  return cachedApiPromise;
}
async function resolveCinejoyStream(requestedServer, tmdbId, type = "movie", season = 1, episode = 1, title, year) {
  try {
    const api = await getCinejoyApi();
    if (!api) return null;
    const serversToTry = requestedServer === "auto" ? ["nebula", "lisbon"] : [requestedServer];
    for (const serverName of serversToTry) {
      try {
        let res = null;
        if (type === "tv") {
          res = await api.qW(serverName, tmdbId, season, episode, void 0, title, year);
        } else {
          res = await api.pW(serverName, tmdbId, void 0, year, title);
        }
        const streamItem = res?.stream?.[0];
        if (streamItem?.playlist) {
          const subtitles = (streamItem.captions || []).map((c) => {
            const proxiedVtt = `/api/stream/proxy?url=${encodeURIComponent(
              c.url
            )}&referer=${encodeURIComponent("https://cinejoy.pk/")}&origin=${encodeURIComponent(
              "https://cinejoy.pk"
            )}`;
            return {
              label: c.language.toUpperCase(),
              lang: c.language,
              url: proxiedVtt,
              file: proxiedVtt,
              kind: "captions",
              default: c.language === "en"
            };
          });
          const proxiedUrl = `/api/stream/proxy?url=${encodeURIComponent(
            streamItem.playlist
          )}&referer=${encodeURIComponent("https://cinejoy.pk/")}&origin=${encodeURIComponent("https://cinejoy.pk")}`;
          return {
            server: `Cinejoy ${serverName === "lisbon" ? "Lisbon (4K)" : serverName === "nebula" ? "Nebula (1080p)" : serverName.toUpperCase()}`,
            streamUrl: proxiedUrl,
            subtitles,
            quality: serverName === "lisbon" ? "4K" : "1080p",
            is4k: serverName === "lisbon"
          };
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    console.error("[Cinejoy] Stream resolution error:", err);
  }
  return null;
}

// src/lib/streaming/rivestream.ts
var RIVE_SCRAPER_BASE = "https://scrapper.rivestream.app";
var RIVE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Referer: "https://www.rivestream.app/",
  Origin: "https://www.rivestream.app",
  Accept: "application/json, text/plain, */*"
};
var RIVESTREAM_PROVIDERS = ["vanguard", "citadel", "mirage", "savannah"];
async function resolveRivestreamProvider(provider, tmdbId, type = "movie", season = 1, episode = 1) {
  try {
    let endpoint = `${RIVE_SCRAPER_BASE}/api/provider?provider=${encodeURIComponent(provider)}&id=${tmdbId}`;
    if (type === "tv") {
      endpoint += `&season=${season}&episode=${episode}`;
    }
    if (provider === "citadel" || provider === "savannah") {
      endpoint += `&cb=${Date.now()}`;
    }
    const res = await fetch(endpoint, {
      headers: RIVE_HEADERS,
      signal: AbortSignal.timeout(5e3)
    });
    if (!res.ok) {
      return { success: false, provider, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const sources = data?.data?.sources || [];
    const captions = data?.data?.captions || [];
    if (!sources || sources.length === 0) {
      return { success: false, provider, error: "No sources returned" };
    }
    const bestSource = sources[0];
    let rawStreamUrl = bestSource.url;
    const subtitles = captions.filter((c) => Boolean(c.file)).map((c) => ({
      label: c.label || c.language || "English",
      lang: (c.language || "en").toLowerCase().slice(0, 2),
      url: `/api/stream/proxy?url=${encodeURIComponent(c.file)}&referer=${encodeURIComponent("https://www.rivestream.app/")}&origin=${encodeURIComponent("https://www.rivestream.app")}`,
      default: (c.label || c.language || "").toLowerCase().includes("english")
    }));
    let proxiedStreamUrl = rawStreamUrl;
    if (rawStreamUrl.includes("proxy.valhallastream.com/m3u8?url=")) {
      try {
        const parsed = new URL(rawStreamUrl);
        const unwrapped = parsed.searchParams.get("url");
        const headersParam = parsed.searchParams.get("headers");
        let upstreamReferer = "https://cinejoy.pk/";
        let upstreamOrigin = "https://cinejoy.pk";
        if (headersParam) {
          try {
            const parsedHeaders = JSON.parse(headersParam);
            if (parsedHeaders.Referer) upstreamReferer = parsedHeaders.Referer;
            if (parsedHeaders.Origin) upstreamOrigin = parsedHeaders.Origin;
          } catch {
          }
        }
        if (unwrapped) {
          proxiedStreamUrl = `/api/stream/proxy?url=${encodeURIComponent(
            unwrapped
          )}&referer=${encodeURIComponent(upstreamReferer)}&origin=${encodeURIComponent(upstreamOrigin)}`;
        }
      } catch {
      }
    } else if (rawStreamUrl && rawStreamUrl.startsWith("http") && !rawStreamUrl.startsWith("/api/stream/proxy")) {
      proxiedStreamUrl = `/api/stream/proxy?url=${encodeURIComponent(
        rawStreamUrl
      )}&referer=${encodeURIComponent("https://www.rivestream.app/")}&origin=${encodeURIComponent("https://www.rivestream.app")}`;
    }
    return {
      success: true,
      provider,
      streamUrl: proxiedStreamUrl,
      rawUrl: rawStreamUrl,
      quality: bestSource.quality,
      subtitles,
      sources
    };
  } catch (err) {
    return {
      success: false,
      provider,
      error: err?.message || "Resolution error"
    };
  }
}
async function resolveRivestreamStream(tmdbId, type = "movie", season = 1, episode = 1, preferredProvider) {
  const providersToTry = preferredProvider ? [preferredProvider, ...RIVESTREAM_PROVIDERS.filter((p) => p !== preferredProvider)] : RIVESTREAM_PROVIDERS;
  for (const provider of providersToTry) {
    const result = await resolveRivestreamProvider(provider, tmdbId, type, season, episode);
    if (result.success && result.streamUrl) {
      return result;
    }
  }
  return {
    success: false,
    provider: "rivestream_auto",
    error: "No working native stream found across Rivestream providers"
  };
}

// src/lib/streaming/kstream.ts
var ANIME_PARADISE_API = "https://api.animeparadise.moe";
var ANIME_PARADISE_STREAM = "https://stream.animeparadise.moe";
var VIDZEE_API = "https://core.vidzee.wtf/streams";
var ANIME_PARADISE_HEADERS = {
  Accept: "application/json, text/plain, */*",
  Referer: "https://animeparadise.moe/",
  Origin: "https://animeparadise.moe",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
};
var VIDZEE_HEADERS = {
  Accept: "application/json, text/plain, */*",
  Referer: "https://player.vidzee.wtf/",
  Origin: "https://player.vidzee.wtf",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
};
async function resolveAnimeParadise(title, episode = 1) {
  try {
    const cleanTitle = (title || "").replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/Season \d+/i, "").trim();
    if (!cleanTitle) {
      return { success: false, server: "animeparadise", error: "Missing title" };
    }
    const searchRes = await fetch(
      `${ANIME_PARADISE_API}/search?q=${encodeURIComponent(cleanTitle)}&limit=15`,
      {
        headers: ANIME_PARADISE_HEADERS,
        signal: AbortSignal.timeout(4e3)
      }
    );
    if (!searchRes.ok) {
      return { success: false, server: "animeparadise", error: `Search HTTP ${searchRes.status}` };
    }
    const searchData = await searchRes.json();
    const items = searchData.data || [];
    if (!items || items.length === 0) {
      return { success: false, server: "animeparadise", error: "Title not found on AnimeParadise" };
    }
    const lowerClean = cleanTitle.toLowerCase();
    const matched = items.find((i) => {
      const t = (i.title || "").toLowerCase();
      const eng = (i.alternativeTitle?.english || "").toLowerCase();
      return t === lowerClean || eng === lowerClean;
    }) || (episode > 1 ? items.sort((a, b) => (b.episodes || 0) - (a.episodes || 0))[0] : items[0]);
    if (!matched?._id) {
      return { success: false, server: "animeparadise", error: "No matching anime ID" };
    }
    const epRes = await fetch(`${ANIME_PARADISE_API}/anime/${matched._id}/episode`, {
      headers: ANIME_PARADISE_HEADERS,
      signal: AbortSignal.timeout(4e3)
    });
    if (!epRes.ok) {
      return { success: false, server: "animeparadise", error: "Failed to fetch episodes" };
    }
    const epJson = await epRes.json();
    const episodes = epJson.data || [];
    const targetEp = episodes.find((e) => Number(e.number) === Number(episode)) || episodes[0];
    if (!targetEp?.uid) {
      return { success: false, server: "animeparadise", error: `Episode ${episode} not found` };
    }
    const streamRes = await fetch(
      `${ANIME_PARADISE_API}/ep/${targetEp.uid}?origin=${matched._id}`,
      {
        headers: ANIME_PARADISE_HEADERS,
        signal: AbortSignal.timeout(5e3)
      }
    );
    if (!streamRes.ok) {
      return { success: false, server: "animeparadise", error: "Failed to resolve stream link" };
    }
    const streamJson = await streamRes.json();
    const epData = streamJson.data?.episode;
    const rawToken = epData?.streamLink;
    if (!rawToken) {
      return { success: false, server: "animeparadise", error: "Empty stream token from upstream" };
    }
    const upstreamM3u8 = `${ANIME_PARADISE_STREAM}/m3u8?url=${encodeURIComponent(rawToken)}`;
    const proxiedM3u8 = `/api/stream/proxy?url=${encodeURIComponent(
      upstreamM3u8
    )}&referer=${encodeURIComponent("https://animeparadise.moe/")}`;
    const seenLangs = /* @__PURE__ */ new Set();
    const subtitles = (epData.subData || []).filter(
      (s) => Boolean(s?.src) && typeof s.src === "string" && (s.src.startsWith("http://") || s.src.startsWith("https://"))
    ).map((s) => {
      const lang = (s.label || "English").toLowerCase().slice(0, 2);
      return {
        label: s.label || "English",
        lang,
        url: s.src,
        default: (s.label || "").toLowerCase().includes("english")
      };
    }).filter((s) => {
      if (seenLangs.has(s.lang)) return false;
      seenLangs.add(s.lang);
      return true;
    });
    return {
      success: true,
      server: "animeparadise",
      streamUrl: proxiedM3u8,
      rawUrl: upstreamM3u8,
      quality: "1080p FHD",
      subtitles,
      skipData: epData.skipData
    };
  } catch (err) {
    return {
      success: false,
      server: "animeparadise",
      error: err?.message || "AnimeParadise resolution error"
    };
  }
}
async function resolveVidZee(tmdbId, type = "movie", season = 1, episode = 1) {
  // 1. Try POST https://core.vidzee.wtf/streams as documented in the Streaming Servers API Guide
  try {
    const postRes = await fetch(VIDZEE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...VIDZEE_HEADERS
      },
      body: JSON.stringify({
        tmdbId: String(tmdbId),
        type: type === "tv" ? "tv" : "movie",
        season: Number(season) || 1,
        episode: Number(episode) || 1
      }),
      signal: AbortSignal.timeout(4000)
    });
    if (postRes.ok) {
      const data = await postRes.json();
      const rawUrl = data?.url || data?.data?.url || data?.stream || data?.data?.stream || data?.streams?.[0]?.url;
      if (rawUrl && typeof rawUrl === "string" && rawUrl.startsWith("http")) {
        const proxied = `/api/stream/proxy?url=${encodeURIComponent(
          rawUrl
        )}&referer=${encodeURIComponent("https://player.vidzee.wtf/")}&origin=${encodeURIComponent("https://player.vidzee.wtf")}`;
        return {
          success: true,
          server: "vidzee",
          streamUrl: proxied,
          rawUrl,
          quality: "1080p FastCloud HLS",
          subtitles: data?.subtitles || data?.data?.subtitles || []
        };
      }
    }
  } catch {}

  // 2. Fallback to GET subservers
  const subServers = ["dcloud", "ipcloud", "tik"];
  const path3 = type === "movie" ? `movie/${tmdbId}` : `tv/${tmdbId}/${season}/${episode}`;
  for (const s of subServers) {
    try {
      const endpoint = `${VIDZEE_API}/${path3}?s=${s}&e=0`;
      const res = await fetch(endpoint, {
        headers: VIDZEE_HEADERS,
        signal: AbortSignal.timeout(3500)
      });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      if (data?.url && typeof data.url === "string" && data.url.startsWith("http")) {
        const proxied = `/api/stream/proxy?url=${encodeURIComponent(
          data.url
        )}&referer=${encodeURIComponent("https://player.vidzee.wtf/")}&origin=${encodeURIComponent("https://player.vidzee.wtf")}`;
        return {
          success: true,
          server: "vidzee",
          streamUrl: proxied,
          rawUrl: data.url,
          quality: "1080p HLS",
          subtitles: []
        };
      }
    } catch {
    }
  }
  return {
    success: false,
    server: "vidzee",
    error: "No active stream found in VidZee cluster"
  };
}

// ─── CineBros API Scraper (Aomine - stellar_hls) ───
async function resolveCineBrosStream(tmdbId, type = "movie", season = 1, episode = 1) {
  try {
    const isTv = type === "tv";
    const referer = isTv ? `https://cinebros.net/watch/tv/${tmdbId}` : `https://cinebros.net/watch/movie/${tmdbId}`;
    const url = `https://cinebros.net/api/streams?tmdbId=${tmdbId}&type=${type}&seasonId=${season}&episodeId=${episode}`;
    const res = await fetch(url, {
      headers: {
        Referer: referer,
        Origin: "https://cinebros.net",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const text = await res.text();
    const rawLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const streams = [];
    const allCaptions = [];
    for (const line of rawLines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.url) streams.push(parsed);
        if (parsed.captions && Array.isArray(parsed.captions)) {
          allCaptions.push(...parsed.captions);
        }
      } catch {}
    }
    if (!streams.length) return null;
    streams.sort((a, b) => (b.quality || 0) - (a.quality || 0));
    const best = streams[0];
    const subtitles = allCaptions.map((c) => ({
      label: c.display || c.language || "English",
      lang: c.language || "en",
      url: c.url,
      default: (c.display || c.language || "").toLowerCase().includes("english")
    }));
    return {
      success: true,
      server: "stellar_hls",
      serverName: `Aomine (${best.name || best.quality + "p"})`,
      mode: "hls",
      streamUrl: best.url,
      rawUrl: best.url,
      headers: { Referer: referer, Origin: "https://cinebros.net" },
      quality: best.quality ? `${best.quality}p` : "1080p Master HLS",
      subtitles,
      is4k: (best.quality || 0) >= 2160
    };
  } catch (err) {
    console.error("[CineBros] Stream resolution error:", err);
    return null;
  }
}

// ─── AniList ID Resolver ───
const anilistTitleCache = new Map();
async function resolveAnilistId(title, idHint) {
  if (idHint && Number(idHint) > 0 && Number(idHint) < 500000) {
    return Number(idHint);
  }
  const cleanTitle = (title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ū/gi, "u")
    .replace(/ō/gi, "o")
    .replace(/Shippūden/gi, "Shippuden")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/Season \d+/i, "")
    .replace(/Part \d+/i, "")
    .trim();
  if (cleanTitle) {
    const cacheKey = cleanTitle.toLowerCase();
    if (anilistTitleCache.has(cacheKey)) {
      return anilistTitleCache.get(cacheKey);
    }
    try {
      const gqlQuery = `query ($search: String) {
        Media (search: $search, type: ANIME) {
          id
        }
      }`;
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: gqlQuery, variables: { search: cleanTitle } }),
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.Media?.id) {
          anilistTitleCache.set(cacheKey, json.data.Media.id);
          return json.data.Media.id;
        }
      }
    } catch {}
  }
  if (idHint && !isNaN(Number(idHint))) {
    return Number(idHint);
  }
  return null;
}

// ─── Kazora Cluster Scraper (Female Titan, Toji, Levi, Goku) ───
async function resolveKazoraStream(clusterId, aniListId, episode = 1, audioType = "sub") {
  try {
    const clusterMap = {
      kazo_anime: "kazora",
      kyoo_anime: "yuri",
      juju_anime: "juju",
      lufi_anime: "lufi",
      miruro_anime: "kazora",
      kazora: "kazora",
      yuri: "yuri",
      juju: "juju",
      lufi: "lufi"
    };
    const clusterNameMap = {
      kazo_anime: "Female Titan",
      kyoo_anime: "Toji",
      juju_anime: "Levi",
      lufi_anime: "Goku",
      miruro_anime: "Shisui"
    };
    const targetCluster = clusterMap[clusterId] || clusterId || "kazora";
    const typeParam = audioType === "dub" ? "dub" : "sub";
    const url = `https://kazora.cc/api/watch?id=${aniListId}&ep=${episode}&server=${targetCluster}&type=${typeParam}`;
    const res = await fetch(url, {
      headers: {
        Referer: "https://kazora.cc/",
        Origin: "https://kazora.cc",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success || !json.results) return null;
    const r = json.results;
    let m3u8Url = "";
    let referer = "https://megaplay.buzz/";
    let origin = "https://megaplay.buzz";
    if (r.playlist) {
      try {
        const parts = r.playlist.replace("/stream-embed/playlist/", "").split(".");
        if (parts.length >= 1) {
          const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
          if (payload.m3u8) m3u8Url = payload.m3u8;
          if (payload.up?.Referer) referer = payload.up.Referer;
          if (payload.up?.Origin) origin = payload.up.Origin;
        }
      } catch (e) {
        console.error("[Kazora] Error parsing JWT playlist:", e);
      }
    }
    if (!m3u8Url && r.embed?.url) {
      try {
        const parts = r.embed.url.replace("/stream-embed/embed/", "").split(".");
        if (parts.length >= 1) {
          const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
          if (payload.m3u8) m3u8Url = payload.m3u8;
          if (payload.up?.Referer) referer = payload.up.Referer;
          if (payload.up?.Origin) origin = payload.up.Origin;
        }
      } catch (e) {
        console.error("[Kazora] Error parsing embed URL:", e);
      }
    }
    if (!m3u8Url) return null;

    const subtitles = (r.tracks || []).map((t) => {
      let subUrl = t.file || "";
      if (typeof t.file === "string" && t.file.includes("?t=")) {
        try {
          const tParam = t.file.split("?t=")[1].split("&")[0];
          const payload = JSON.parse(Buffer.from(tParam.split(".")[0], "base64url").toString("utf8"));
          if (payload.u) subUrl = payload.u;
        } catch {}
      }
      return {
        label: t.label || t.lang || "English",
        lang: t.lang || "en",
        url: `/api/stream/proxy?url=${encodeURIComponent(subUrl)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`,
        default: Boolean(t.default) || t.lang === "en" || t.lang === "eng"
      };
    });

    const proxiedStreamUrl = `/api/stream/proxy?url=${encodeURIComponent(m3u8Url)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
    return {
      success: true,
      server: clusterId,
      serverName: clusterNameMap[clusterId] || clusterId,
      mode: "hls",
      streamUrl: proxiedStreamUrl,
      rawUrl: m3u8Url,
      subtitles,
      quality: "1080p Master HLS",
      skipData: {
        intro: r.intro,
        outro: r.outro
      },
      supportsDualAudio: true,
      hasDub: Boolean(r.servers?.dub && r.servers.dub.length > 0)
    };
  } catch (err) {
    console.error("[Kazora] Stream resolution error:", err);
    return null;
  }
}

// src/lib/streaming/kaa.ts
var KAA_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
async function resolveKAAStream(title, episode = 1, _preferredAudio = "dub") {
  try {
    let cleanTitle = (title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ū/gi, "u").replace(/ō/gi, "o").replace(/Shippūden/gi, "Shippuden").replace(/Shippuuden/gi, "Shippuden").replace(/\s*S\d+\s*E\d+.*$/i, "").replace(/\s*Season\s*\d+.*$/i, "").replace(/\s*Episode\s*\d+.*$/i, "").replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/[:\-]\s*ep(isode)?\s*\d+.*$/i, "").replace(/[:]/g, " ").replace(/\s+/g, " ").trim();
    if (!cleanTitle) return null;
    const searchRes = await fetch("https://kaa.lt/api/fsearch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://kaa.lt/",
        "User-Agent": KAA_USER_AGENT
      },
      body: JSON.stringify({ query: cleanTitle }),
      signal: AbortSignal.timeout(4500)
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    let shows = searchData?.result || [];
    if (!shows.length && cleanTitle.includes(" ")) {
      const shorter = cleanTitle.split(" ").slice(0, 2).join(" ");
      const retryRes = await fetch("https://kaa.lt/api/fsearch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: "https://kaa.lt/",
          "User-Agent": KAA_USER_AGENT
        },
        body: JSON.stringify({ query: shorter }),
        signal: AbortSignal.timeout(4500)
      });
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        shows = retryData?.result || [];
      }
    }
    if (!shows.length) return null;
    const targetSlug = cleanTitle.toLowerCase().replace(/shippuuden/gi, "shippuden").replace(/[^a-z0-9]/g, "");
    const show = shows.find((s) => {
      const slug = (s.slug || "").toLowerCase();
      const t = (s.title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ū/gi, "u").replace(/ō/gi, "o").replace(/shippuuden/gi, "shippuden").toLowerCase();
      const normClean = cleanTitle.toLowerCase();
      const isNotExtra = !slug.includes("pv") && !slug.includes("trailer") && !slug.includes("music") && !slug.includes("movie") && !t.includes("movie") && !t.includes("official pv") && !t.includes("trailer") && s.type !== "special";
      const normShowSlug = slug.replace(/[^a-z0-9]/g, "");
      const slugMatch = normShowSlug.startsWith(targetSlug) || normShowSlug.includes(targetSlug) || targetSlug.includes(normShowSlug);
      const titleMatch = t === normClean || t.includes(normClean) || normClean.includes(t) || t.startsWith(normClean + " ") || normClean.startsWith(t + " ");
      return isNotExtra && (slugMatch || titleMatch);
    }) || shows[0];
    if (!show?.slug) return null;
    const page = Math.ceil(Number(episode) / 100) || 1;
    let epRes = await fetch(`https://kaa.lt/api/show/${show.slug}/episodes?lang=ja-JP&page=${page}`, {
      headers: {
        Referer: "https://kaa.lt/",
        "User-Agent": KAA_USER_AGENT
      },
      signal: AbortSignal.timeout(4500)
    });
    let epData = epRes.ok ? await epRes.json() : null;
    let episodes = epData?.result || [];
    if (!episodes.length) {
      epRes = await fetch(`https://kaa.lt/api/show/${show.slug}/episodes?lang=en-US&page=${page}`, {
        headers: {
          Referer: "https://kaa.lt/",
          "User-Agent": KAA_USER_AGENT
        },
        signal: AbortSignal.timeout(4500)
      });
      epData = epRes.ok ? await epRes.json() : null;
      episodes = epData?.result || [];
    }
    const targetEp = episodes.find(
      (e) => e.episode_number === Number(episode) || e.episode_string === String(episode)
    );
    if (!targetEp?.slug) return null;
    const epPageUrl = `https://kaa.lt/${show.slug}/ep-${targetEp.episode_number}-${targetEp.slug}`;
    const pageRes = await fetch(epPageUrl, {
      headers: {
        Referer: "https://kaa.lt/",
        "User-Agent": KAA_USER_AGENT
      },
      signal: AbortSignal.timeout(5e3)
    });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    let playerUrl = null;
    const catMatch = html.match(/src:"([^"]+cat-player[^"]+)"/i) || html.match(/src:\s*["']([^"']+)["']/i);
    if (catMatch?.[1]) {
      playerUrl = catMatch[1].replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
    }

    let rawStreamUrl = '';
    const subtitles = [];

    if (playerUrl) {
      try {
        const playerRes = await fetch(playerUrl, {
          headers: { Referer: "https://kaa.lt/", "User-Agent": KAA_USER_AGENT },
          signal: AbortSignal.timeout(4500)
        });
        if (playerRes.ok) {
          const playerHtml = await playerRes.text();
          const manifestMatch = playerHtml.match(/&quot;manifest&quot;:\s*\[\s*\d+\s*,\s*&quot;([^&]+)&quot;/i) ||
                                playerHtml.match(/"manifest":\s*\[\s*\d+\s*,\s*"([^"]+)"/i) ||
                                playerHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);

          rawStreamUrl = manifestMatch?.[1] || manifestMatch?.[0] || '';
          if (rawStreamUrl.startsWith('//')) {
            rawStreamUrl = 'https:' + rawStreamUrl;
          }

          const srtRegex = /&quot;name&quot;:\[\d+,&quot;([^&]+)&quot;\],&quot;source&quot;:\[\d+,&quot;[^&]+&quot;\],&quot;src&quot;:\[\d+,&quot;([^&]+)&quot;\]/g;
          let sm;
          while ((sm = srtRegex.exec(playerHtml)) !== null) {
            let src = sm[2];
            if (src.startsWith('https:///')) src = src.replace('https:///', 'https://');
            subtitles.push({ label: sm[1], url: src, default: sm[1].toLowerCase().includes('en') });
          }
        }
      } catch { /* ignore player fetch error */ }
    }

    if (!rawStreamUrl) {
      const idMatch = html.match(/id=([a-f0-9]{24})/);
      if (idMatch?.[1]) {
        rawStreamUrl = `https://hls.krussdomi.com/manifest/${idMatch[1]}/master.m3u8`;
      }
    }

    if (!rawStreamUrl) return null;

    const proxiedUrl = `/api/stream/proxy?url=${encodeURIComponent(
      rawStreamUrl
    )}&referer=${encodeURIComponent("https://krussdomi.com/")}&origin=${encodeURIComponent(
      "https://krussdomi.com"
    )}`;
    return {
      success: true,
      server: "kaa_anime",
      serverName: "Yuji (KickAssAnime Dual-Audio HLS)",
      streamUrl: proxiedUrl,
      type: "m3u8",
      format: "hls",
      quality: "1080p Master HLS",
      hasDub: true,
      supportsDualAudio: true,
      subtitles
    };
  } catch (err) {
    console.error("resolveKAA error:", err);
    return null;
  }
}

// src/lib/streaming/stellar.ts


var cachedEngine = null;
var engineInitPromise = null;
async function getWasmEngine() {
  if (cachedEngine) return cachedEngine;
  if (engineInitPromise) return engineInitPromise;
  engineInitPromise = (async () => {
    try {
      let jsPath = path.join(process.cwd(), "src/lib/streaming/stellar-engine/engine.js");
      let wasmPath = path.join(process.cwd(), "src/lib/streaming/stellar-engine/engine.wasm");
      if (!fs.existsSync(jsPath) || !fs.existsSync(wasmPath)) {
        jsPath = path.join(process.cwd(), "src/lib/stellar-engine/engine.js");
        wasmPath = path.join(process.cwd(), "src/lib/stellar-engine/engine.wasm");
      }
      if (!fs.existsSync(jsPath) || !fs.existsSync(wasmPath)) {
        console.error("[Stellar] Engine files not found at:", jsPath, wasmPath);
        return null;
      }
      const engineCode = fs.readFileSync(jsPath, "utf8");
      const wasmBuffer = fs.readFileSync(wasmPath);
      const fn = new Function(engineCode + "; return wasm_bindgen;");
      const wasm = fn();
      wasm.initSync({ module: wasmBuffer });
      if (wasm.init_session) wasm.init_session();
      cachedEngine = wasm;
      return wasm;
    } catch (err) {
      console.error("[Stellar] Failed to initialize Wasm engine:", err);
      return null;
    }
  })();
  return engineInitPromise;
}
async function callStellarProtected(engine, endpoint, payload) {
  const encrypted = engine.encrypt_request_payload(JSON.stringify(payload));
  const res = await fetch(`https://api.stellar.gdn${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Referer: "https://stellar.gdn/",
      Origin: "https://stellar.gdn",
      Accept: "*/*"
    },
    body: Buffer.from(encrypted),
    signal: AbortSignal.timeout(2800)
  });
  if (!res.ok) {
    throw new Error(`Stellar API ${endpoint} failed with HTTP ${res.status}`);
  }
  const arrayBuf = await res.arrayBuffer();
  if (!arrayBuf || arrayBuf.byteLength === 0) {
    throw new Error(`Empty response from Stellar API ${endpoint}`);
  }
  const decryptedStr = engine.decrypt_response_payload_bytes(new Uint8Array(arrayBuf));
  return JSON.parse(decryptedStr);
}
async function resolveStellarStream(targetServer = "auto", tmdbId, type, season = 1, episode = 1) {
  try {
    const engine = await getWasmEngine();
    if (!engine) return null;
    const numericTmdbId = typeof tmdbId === "string" ? parseInt(tmdbId, 10) : tmdbId;
    if (!numericTmdbId || isNaN(numericTmdbId)) return null;
    let serverCandidates = [];
    if (targetServer === "miami" || targetServer === "stellar_miami") {
      serverCandidates = ["Miami", "Boise", "Atlanta"];
    } else if (targetServer === "boise" || targetServer === "stellar_boise") {
      serverCandidates = ["Boise", "Miami", "Atlanta"];
    } else if (targetServer === "atlanta") {
      serverCandidates = ["Atlanta", "Miami", "Boise"];
    } else {
      serverCandidates = ["Miami", "Boise", "Atlanta", "Orlando"];
    }
    const sNum = typeof season === "string" ? parseInt(season, 10) : season;
    const eNum = typeof episode === "string" ? parseInt(episode, 10) : episode;
    let streamData = null;
    let chosenServer = "";
    for (const s of serverCandidates) {
      try {
        const payload = {
          mediaType: type === "tv" ? "tv" : "movie",
          id: String(numericTmdbId),
          source: s
        };
        if (type === "tv") {
          payload.season = sNum || 1;
          payload.episode = eNum || 1;
        }
        const res = await callStellarProtected(engine, "/api/r", payload);
        if (res && res.url) {
          streamData = res;
          chosenServer = s;
          break;
        }
      } catch {
        continue;
      }
    }
    if (!streamData?.url) return null;
    let subtitles = [];
    try {
      const subPayload = {
        mediaType: type === "tv" ? "tv" : "movie",
        id: numericTmdbId
      };
      if (type === "tv") {
        subPayload.season = sNum || 1;
        subPayload.episode = eNum || 1;
      }
      const subRes = await callStellarProtected(engine, "/api/subtitles", subPayload);
      if (Array.isArray(subRes?.subtitles)) {
        subtitles = subRes.subtitles.map((sub) => ({
          label: sub.label || sub.language || "Subtitle",
          lang: sub.language || "en",
          url: `/api/stream/proxy?url=${encodeURIComponent(sub.url)}&referer=${encodeURIComponent("https://stellar.gdn/")}&origin=${encodeURIComponent("https://stellar.gdn")}`,
          source: sub.source || "Stellar",
          default: sub.language === "en"
        }));
      }
    } catch {
    }
    const rawUrl = streamData.url;
    const is4k = streamData.quality?.toLowerCase()?.includes("4k") || streamData.qualities?.some((q) => (q.quality || q).toString().toLowerCase().includes("4k")) || false;
    const proxiedStreamUrl = `/api/stream/proxy?url=${encodeURIComponent(
      rawUrl
    )}&referer=${encodeURIComponent("https://stellar.gdn/")}&origin=${encodeURIComponent("https://stellar.gdn")}`;
    const qualitiesList = Array.isArray(streamData.qualities) ? streamData.qualities.map((q) => q.quality || q) : streamData.quality ? [streamData.quality] : [];
    return {
      streamUrl: proxiedStreamUrl,
      server: `Stellar ${chosenServer} (${is4k ? "4K" : streamData.quality || "1080p"})`,
      quality: streamData.quality || (is4k ? "4K" : "1080p"),
      qualities: qualitiesList,
      subtitles,
      is4k
    };
  } catch (err) {
    console.error("[Stellar] Stream resolution error:", err);
    return null;
  }
}

// src/lib/streaming/miruro.ts

var fs2 = fs;
var path2 = path;
var animeIdCache = /* @__PURE__ */ new Map([
  ["one piece", "ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz"],
  ["jujutsu kaisen", "l9aQcH0K4elYGR6uiKnFUiymK44zIuzo"],
  ["jujutsu kaisen season 2", "l9aQcH0K4elYGR6uiKnFUiymK44zIuzo"]
]);
var sourcesCache = /* @__PURE__ */ new Map();
var SOURCES_CACHE_TTL = 10 * 60 * 1e3;
function getCurlBin() {
  if (process.platform === "win32") {
    try {
      const gitA = ["C:", "Program Files", "Git", "mingw64", "bin", "curl.exe"].join(path2.sep);
      const gitB = ["C:", "Program Files", "Git", "usr", "bin", "curl.exe"].join(path2.sep);
      if (fs2.existsSync(gitA)) return gitA;
      if (fs2.existsSync(gitB)) return gitB;
    } catch {
    }
  }
  return "curl";
}
function fetchTextWithCurl(url, headers = {}) {
  const curlBin = getCurlBin();
  return new Promise((resolve, reject) => {
    const args = ["-s", "-4", "--connect-timeout", "4", "--max-time", "8", "--http1.1", "--compressed"];
    for (const [k, v] of Object.entries(headers)) {
      args.push("-H", `${k}: ${v}`);
    }
    args.push(url);
    execFile(
      /*turbopackIgnore: true*/
      curlBin,
      args,
      { maxBuffer: 15 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        if (!stdout || stdout.length === 0) return reject(new Error("Empty response from curl"));
        resolve(stdout);
      }
    );
  });
}
async function requestMiruro(url, retries = 2) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    Referer: "https://barelystarted.miruro.tv/",
    Accept: "text/html,application/json,*/*"
  };
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(4500)
    });
    if (res.ok) {
      return await res.text();
    }
  } catch (err) {
    console.error("[Miruro native fetch error]:", err);
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchTextWithCurl(url, headers);
    } catch (err) {
      if (attempt === retries) {
        console.error(`[Miruro] fetch error for ${url}:`, err);
        return "";
      }
      await new Promise((res) => setTimeout(res, 150));
    }
  }
  return "";
}
async function findMiruroMediaId(title) {
  if (!title) return null;
  const cleanTitle = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ū/gi, "u").replace(/ō/gi, "o").replace(/Shippūden/gi, "Shippuden").replace(/Shippuuden/gi, "Shippuden").replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/Season \d+/i, "").replace(/Part \d+/i, "").trim();
  const cacheKey = cleanTitle.toLowerCase();
  if (animeIdCache.has(cacheKey)) {
    return animeIdCache.get(cacheKey);
  }
  try {
    const searchUrl = `https://barelystarted.miruro.tv/search?q=${encodeURIComponent(cleanTitle)}`;
    const html = await requestMiruro(searchUrl);
    if (!html) return null;
    const anchorRegex = /href="\/info\/([a-zA-Z0-9_\-]+)\/([^"#\?]+)"/g;
    let m;
    const candidates = [];
    while ((m = anchorRegex.exec(html)) !== null) {
      candidates.push({ id: m[1], slug: m[2].toLowerCase() });
    }
    if (candidates.length > 0) {
      const targetSlug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const exact = candidates.find((c) => c.slug === targetSlug);
      if (exact) {
        animeIdCache.set(cacheKey, exact.id);
        return exact.id;
      }
      const prefixMatch = candidates.find(
        (c) => c.slug.startsWith(targetSlug + "-") || targetSlug.startsWith(c.slug + "-")
      );
      if (prefixMatch) {
        animeIdCache.set(cacheKey, prefixMatch.id);
        return prefixMatch.id;
      }
      const targetWords = targetSlug.split("-").filter((w) => w.length > 2);
      if (targetWords.length > 0) {
        const bestCandidate = candidates.find((c) => {
          const candWords = c.slug.split("-").filter((w) => w.length > 2);
          const matchCount = targetWords.filter((tw) => candWords.includes(tw)).length;
          return matchCount / targetWords.length >= 0.6;
        });
        if (bestCandidate) {
          animeIdCache.set(cacheKey, bestCandidate.id);
          return bestCandidate.id;
        }
      }
    }
    const jsonRegex = /\{id:"([^"]+)",external_ids:\{[^}]*\},title:\{romaji:"([^"]+)"(?:,english:([^\,\}]+))?/g;
    let jm;
    const lowerClean = cleanTitle.toLowerCase();
    while ((jm = jsonRegex.exec(html)) !== null) {
      const id = jm[1];
      const romaji = (jm[2] || "").toLowerCase();
      const eng = (jm[3] || "").replace(/"/g, "").toLowerCase();
      if (romaji && (romaji === lowerClean || romaji.startsWith(lowerClean) || lowerClean.startsWith(romaji)) || eng && (eng === lowerClean || eng.startsWith(lowerClean) || lowerClean.startsWith(eng))) {
        animeIdCache.set(cacheKey, id);
        return id;
      }
    }
  } catch (err) {
    console.error("[Miruro] Error searching anime:", err);
  }
  return null;
}
async function resolveMiruroStream(title, episode = 1, audioMode = "dub") {
  try {
    const mediaId = await findMiruroMediaId(title);
    if (!mediaId) return null;
    const epNum = typeof episode === "string" ? parseInt(episode, 10) : episode;
    const cacheKey = `${mediaId}:${epNum || 1}`;
    let data = null;
    const cached = sourcesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SOURCES_CACHE_TTL) {
      data = cached.data;
    } else {
      const sourcesUrl = `https://barelystarted.miruro.tv/api/sources?id=${encodeURIComponent(
        mediaId
      )}&n=${epNum || 1}`;
      const jsonStr = await requestMiruro(sourcesUrl);
      if (!jsonStr) return null;
      data = JSON.parse(jsonStr);
      if (data && data.tracks) {
        sourcesCache.set(cacheKey, { data, timestamp: Date.now() });
      }
    }
    if (!data || !data.tracks || !Array.isArray(data.tracks)) return null;
    const dubTrack = data.tracks.find((t) => t.track === "dub");
    const subTrack = data.tracks.find((t) => t.track === "ssub") || data.tracks.find((t) => t.track === "sub");
    const targetTrack = audioMode === "dub" ? dubTrack || subTrack : subTrack || dubTrack;
    if (!targetTrack || !targetTrack.providers) return null;
    let subtitles = [];
    const sourceSubs = targetTrack.providers?.find((p) => p.subtitles?.length > 0)?.subtitles || subTrack?.providers?.find((p) => p.subtitles?.length > 0)?.subtitles || targetTrack.subtitles || subTrack?.subtitles || [];
    if (Array.isArray(sourceSubs) && sourceSubs.length > 0) {
      subtitles = sourceSubs.filter((s) => {
        if (!s.file || typeof s.file !== "string") return false;
        const lower = s.file.toLowerCase();
        if (lower.endsWith(".jpeg") || lower.endsWith(".jpg") || lower.endsWith(".png") || lower.includes(".top/a/")) {
          return false;
        }
        return true;
      }).map((s) => ({
        label: s.label || s.language || "Subtitle",
        lang: s.language || "en",
        url: `/api/stream/proxy?url=${encodeURIComponent(s.file)}&referer=${encodeURIComponent(
          "https://barelystarted.miruro.tv/"
        )}&origin=${encodeURIComponent("https://barelystarted.miruro.tv")}`,
        source: "Miruro",
        default: Boolean(s.default) || s.language === "en" || s.language === "eng"
      }));
    }
    const priorityProviders = ["bee", "sun", "hop", "knob"];
    const allProviders = targetTrack.providers;
    let chosenStreamUrl = "";
    let chosenHeaders = {};
    let chosenServerName = "";
    let chosenProviderName = "";
    for (const provCode of priorityProviders) {
      const prov = allProviders.find((p) => p.provider === provCode);
      if (!prov || !prov.servers) continue;
      for (const s of prov.servers) {
        if (s.streams && s.streams.length > 0 && s.streams[0].url) {
          chosenStreamUrl = s.streams[0].url;
          chosenHeaders = s.headers || {};
          chosenServerName = s.server || provCode;
          chosenProviderName = provCode;
          break;
        }
      }
      if (chosenStreamUrl) break;
    }
    if (!chosenStreamUrl) {
      for (const prov of allProviders) {
        for (const s of prov.servers || []) {
          if (s.streams && s.streams.length > 0 && s.streams[0].url) {
            chosenStreamUrl = s.streams[0].url;
            chosenHeaders = s.headers || {};
            chosenServerName = s.server || prov.provider;
            chosenProviderName = prov.provider;
            break;
          }
        }
        if (chosenStreamUrl) break;
      }
    }
    if (!chosenStreamUrl) {
      const kaa = await resolveKAAStream(title, episode, audioMode);
      if (kaa?.streamUrl) {
        return {
          streamUrl: kaa.streamUrl,
          server: "Shisui (Master HLS)",
          provider: "kaa",
          subtitles: [],
          quality: kaa.quality || "1080p Master HLS",
          hasDub: true
        };
      }
      return null;
    }
    const referer = chosenHeaders["Referer"] || (chosenProviderName === "bee" ? "https://megaplay.buzz/" : chosenProviderName === "sun" ? "https://ultracloud.cc/" : chosenProviderName === "hop" ? "https://krussdomi.com/" : "https://barelystarted.miruro.tv/");
    const origin = chosenHeaders["Origin"] || (chosenProviderName === "sun" ? "https://ultracloud.cc" : void 0);
    let proxyUrl = `/api/stream/proxy?url=${encodeURIComponent(chosenStreamUrl)}&referer=${encodeURIComponent(
      referer
    )}`;
    if (origin) {
      proxyUrl += `&origin=${encodeURIComponent(origin)}`;
    }
    return {
      streamUrl: proxyUrl,
      server: `Miruro ${chosenServerName} (${audioMode.toUpperCase()})`,
      provider: chosenProviderName,
      subtitles,
      quality: "1080p",
      hasDub: Boolean(dubTrack && dubTrack.providers?.length > 0)
    };
  } catch (err) {
    console.error("[Miruro] Stream resolution error:", err);
  }
  try {
    const kaa = await resolveKAAStream(title, episode, audioMode);
    if (kaa?.streamUrl) {
      return {
        streamUrl: kaa.streamUrl,
        server: "Shisui (Master HLS)",
        provider: "kaa",
        subtitles: [],
        quality: kaa.quality || "1080p Master HLS",
        hasDub: true
      };
    }
  } catch (e) {
    console.error("[Shisui KAA fallback error]:", e);
  }
  return null;
}

// src/lib/streaming/movienight.ts
var MOVIENIGHT_BASE = "https://movienig.ht";
var TMDB_API_KEY = "cd02d9e0ed072fcea61ee0d7199ea48e";
var MOVIENIGHT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://movienig.ht/",
  Origin: "https://movienig.ht",
  Accept: "application/json, text/plain, */*"
};
var imdbCache = /* @__PURE__ */ new Map();
async function getImdbId(tmdbId, type = "movie", explicitImdbId) {
  if (explicitImdbId && explicitImdbId.startsWith("tt")) {
    return explicitImdbId;
  }
  const cacheKey = `${type}:${tmdbId}`;
  if (imdbCache.has(cacheKey)) {
    return imdbCache.get(cacheKey);
  }
  if (String(tmdbId).startsWith("tt")) {
    return String(tmdbId);
  }
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${type === "tv" ? "tv" : "movie"}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`,
      { signal: AbortSignal.timeout(6e3) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.imdb_id) {
        imdbCache.set(cacheKey, data.imdb_id);
        return data.imdb_id;
      }
    }
  } catch (err) {
    console.error(`[MovieNight] Failed to fetch IMDB ID for ${type} ${tmdbId}:`, err);
  }
  return null;
}
async function getMediaMeta(tmdbId, type) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${type === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}`,
      { signal: AbortSignal.timeout(6e3) }
    );
    if (res.ok) {
      const data = await res.json();
      const title = data?.title || data?.name || "";
      const releaseDate = data?.release_date || data?.first_air_date || "";
      const year = releaseDate ? releaseDate.split("-")[0] : void 0;
      return { title, year };
    }
  } catch {
  }
  return { title: "" };
}
async function resolveMovieNightStream(tmdbId, type = "movie", season = 1, episode = 1, title, preferredServer, explicitImdbId, year) {
  try {
    const imdbId = await getImdbId(tmdbId, type, explicitImdbId);
    if (!imdbId) {
      return { success: false, server: preferredServer || "movienight", error: "Could not find IMDB ID" };
    }
    let mediaTitle = title;
    let mediaYear = year;
    if (!mediaTitle || !mediaYear) {
      const meta = await getMediaMeta(tmdbId, type);
      if (!mediaTitle) mediaTitle = meta.title;
      if (!mediaYear) mediaYear = meta.year;
    }
    let endpoint = type === "tv" ? `${MOVIENIGHT_BASE}/api/stream/v1/tv/${imdbId}/${season}/${episode}?tmdbId=${tmdbId}&title=${encodeURIComponent(
      mediaTitle || ""
    )}` : `${MOVIENIGHT_BASE}/api/stream/v1/movie/${imdbId}?tmdbId=${tmdbId}&title=${encodeURIComponent(
      mediaTitle || ""
    )}`;
    if (mediaYear) {
      endpoint += `&year=${mediaYear}`;
    }
    if (preferredServer) {
      endpoint += `&server=${encodeURIComponent(preferredServer)}`;
    }
    const headers = {
      ...MOVIENIGHT_HEADERS,
      Referer: `${MOVIENIGHT_BASE}/watch/${type === "tv" ? "tv" : "movie"}/${imdbId}`
    };
    const res = await fetch(endpoint, {
      headers,
      signal: AbortSignal.timeout(3e3)
    });
    if (!res.ok) {
      return {
        success: false,
        server: preferredServer || "movienight",
        error: `MovieNight returned HTTP ${res.status}`
      };
    }
    const data = await res.json();
    const sources = data?.sources || [];
    if (!sources || sources.length === 0 || !sources[0]?.url) {
      return {
        success: false,
        server: preferredServer || "movienight",
        error: data?.error || "No playable stream sources returned"
      };
    }
    const bestSource = sources[0];
    const rawStreamUrl = bestSource.url;
    const subtitles = (data?.subtitles || []).filter((s) => s?.url || s?.file).map((s) => ({
      label: s.label || s.language || "English",
      lang: (s.lang || s.language || "en").toLowerCase().slice(0, 2),
      url: s.url || s.file,
      default: Boolean(s.default)
    }));
    const proxiedStreamUrl = `/api/stream/proxy?url=${encodeURIComponent(
      rawStreamUrl
    )}&referer=${encodeURIComponent("https://movienig.ht/")}&origin=${encodeURIComponent(
      "https://movienig.ht"
    )}`;
    return {
      success: true,
      server: data.server || preferredServer || "salem",
      streamUrl: proxiedStreamUrl,
      rawUrl: rawStreamUrl,
      quality: bestSource.quality || "auto",
      subtitles
    };
  } catch (err) {
    return {
      success: false,
      server: preferredServer || "movienight",
      error: err?.message || "Failed to resolve stream from MovieNight cluster"
    };
  }
}

// api/stream/resolve.ts
async function resolveRealTmdbId(tmdbId, title, type) {
  if (tmdbId && /^\d+$/.test(tmdbId)) {
    return tmdbId;
  }
  const TMDB_KEY = "cd02d9e0ed072fcea61ee0d7199ea48e";
  if (title) {
    const cleanTitle = title.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").trim();
    try {
      const searchRes = await fetch(
        `https://api.tmdb.org/3/search/${type === "tv" ? "tv" : "movie"}?api_key=${TMDB_KEY}&query=${encodeURIComponent(cleanTitle)}`,
        { signal: AbortSignal.timeout(1500) }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.results && searchData.results.length > 0) {
          return String(searchData.results[0].id);
        }
      }
    } catch {
    }
  }
  return tmdbId;
}
var SHIOPA_SECRET = "poprink_security_v2_2026";
var SHIOPA_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function shiopaHmac(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest("hex");
}
function makeShiopaSk(id) {
  const t = Date.now();
  const n = Math.random().toString(36).substring(2, 15);
  const h = shiopaHmac(SHIOPA_SECRET, `${t}:${n}:${id}:/api/streams`);
  return { token: Buffer.from(JSON.stringify({ t, n, h })).toString("base64"), t, n };
}
function shiopaRc4(base64Payload, key) {
  const data = Buffer.from(base64Payload, "base64");
  const s = Array.from({ length: 256 }, (_, i2) => i2);
  let j = 0;
  for (let i2 = 0; i2 < 256; i2++) {
    j = (j + s[i2] + key.charCodeAt(i2 % key.length)) % 256;
    const tmp = s[i2];
    s[i2] = s[j];
    s[j] = tmp;
  }
  let i = 0;
  j = 0;
  const out = new Uint8Array(data.length);
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
    out[k] = data[k] ^ s[(s[i] + s[j]) % 256];
  }
  return new TextDecoder().decode(out);
}
function shiopaShift(text, key) {
  let out = "";
  const keyLen = key.length;
  for (let idx = 0; idx < text.length; idx++) {
    const char = text[idx];
    const pos = SHIOPA_B64.indexOf(char);
    if (pos !== -1) {
      const shiftVal = key.charCodeAt(idx % keyLen) % 65;
      out += SHIOPA_B64[(pos - shiftVal + 65) % 65];
    } else {
      out += char;
    }
  }
  return out;
}
function shiopaXor(base64Text, key) {
  const data = Buffer.from(base64Text, "base64");
  const out = new Uint8Array(data.length);
  const keyLen = key.length;
  for (let idx = 0; idx < data.length; idx++) {
    out[idx] = data[idx] ^ (key.charCodeAt(idx % keyLen) + idx) % 256;
  }
  return new TextDecoder().decode(out);
}
async function resolveShiopaStream(tmdbId, type, season, episode) {
  try {
    const skInfo = makeShiopaSk(tmdbId);
    let query = `id=${tmdbId}&type=${type}`;
    if (type === "tv") query += `&season=${season}&episode=${episode}`;
    const res = await fetch(`https://shiopa.com/api/streams?${query}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: `https://shiopa.com/watch/${tmdbId}`,
        Accept: "application/json",
        "x-sk": skInfo.token
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.v !== 1 || !json.p) return null;
    const keyA = shiopaHmac(SHIOPA_SECRET, `${skInfo.t}:${skInfo.n}:xor`);
    const keyB = shiopaHmac(SHIOPA_SECRET, `${skInfo.t}:${skInfo.n}:shift`);
    const keyC = shiopaHmac(SHIOPA_SECRET, `${skInfo.t}:${skInfo.n}:rc4`);
    const step1 = shiopaRc4(json.p, keyC);
    const step2 = shiopaShift(step1, keyB);
    const step3 = shiopaXor(step2, keyA);
    const decrypted = JSON.parse(step3);
    if (!decrypted?.results?.length) return null;
    for (const r of decrypted.results) {
      if (!r.streams?.length) continue;
      const sortedStreams = [...r.streams].sort((a, b) => {
        const getScore = (url = "") => {
          const u = url.toLowerCase();
          if (u.includes("1080p") || u.includes("1080")) return 100;
          if (u.includes("720p") || u.includes("720")) return 90;
          if (u.includes("480p") || u.includes("360p")) return 50;
          if (u.includes("2160p") || u.includes("4k")) return 10;
          return 70;
        };
        return getScore(b.url) - getScore(a.url);
      });
      for (const s of sortedStreams) {
        let streamUrl = s.url;
        let headers = s.headers || {};
        const tokMatch = s.url?.match(/tok=([^&]+)/);
        if (tokMatch) {
          try {
            const parsedTok = JSON.parse(Buffer.from(tokMatch[1], "base64").toString("utf8"));
            const decodedD = JSON.parse(Buffer.from(parsedTok.d, "base64").toString("utf8"));
            if (decodedD.url) {
              streamUrl = decodedD.url;
              if (decodedD.headers) headers = { ...headers, ...decodedD.headers };
            }
          } catch {
          }
        }
        if (streamUrl && streamUrl.startsWith("http")) {
          return {
            server: r.serverName || r.server,
            streamUrl,
            headers
          };
        }
      }
    }
  } catch {
  }
  return null;
}
async function fetchPublicSubtitles(imdbId, type, season, episode) {
  if (!imdbId || !imdbId.startsWith("tt")) return [];
  try {
    const epPath = type === "tv" ? `series/${imdbId}%3A${season || 1}%3A${episode || 1}.json` : `movie/${imdbId}.json`;
    const res = await fetch(`https://opensubtitles-v3.strem.io/subtitles/${epPath}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(1800)
    });
    if (!res.ok) return [];
    const data = await res.json();
    const subs = data?.subtitles || [];
    const results = [];
    const seenLangs = /* @__PURE__ */ new Set();
    const labelMap = {
      eng: "English",
      en: "English",
      spa: "Spanish",
      es: "Spanish",
      fra: "French",
      fr: "French",
      deu: "German",
      de: "German",
      ita: "Italian",
      it: "Italian",
      por: "Portuguese",
      pob: "Portuguese (BR)",
      pt: "Portuguese",
      hin: "Hindi",
      hi: "Hindi",
      ara: "Arabic",
      ar: "Arabic",
      rus: "Russian",
      ru: "Russian"
    };
    for (const s of subs) {
      if (!s.url || !s.lang) continue;
      const langCode = s.lang.toLowerCase();
      if (seenLangs.has(langCode)) continue;
      seenLangs.add(langCode);
      const langName = labelMap[langCode] || langCode.toUpperCase();
      const proxiedSubUrl = `/api/stream/proxy?url=${encodeURIComponent(s.url)}`;
      results.push({
        label: langName,
        lang: langCode.slice(0, 2),
        url: proxiedSubUrl,
        default: langCode.startsWith("en") && !results.some((r) => r.default)
      });
      if (results.length >= 8) break;
    }
    return results;
  } catch {
    return [];
  }
}
async function handleResolve(searchParams) {
  const serverId = searchParams.get("server") || searchParams.get("serverId") || "poseidon";
  const rawTmdbId = searchParams.get("tmdbId") || "";
  const title = searchParams.get("title") || "";
  const rawType = (searchParams.get("type") || "").toLowerCase();
  const type = rawType === "tv" || rawType === "series" ? "tv" : "movie";
  const season = searchParams.get("season") || "1";
  const episode = searchParams.get("episode") || "1";
  const audio = searchParams.get("audio") || "dub";
  const checkDubOnly = searchParams.get("checkDub") === "true";
  const imdbId = searchParams.get("imdbId") || "";
  const year = searchParams.get("year") || "";
  const tmdbId = await resolveRealTmdbId(rawTmdbId, title, type);
  if (checkDubOnly) {
    if (title) {
      try {
        const miruroTest = await resolveMiruroStream(title, episode, "dub");
        if (miruroTest && typeof miruroTest.hasDub === "boolean") {
          return { status: 200, data: { hasDub: miruroTest.hasDub } };
        }
      } catch {
      }
    }
    try {
      const checkRes = await fetch(
        `https://kazora.cc/api/watch?id=${tmdbId}&ep=${episode}&server=kaa&type=dub`,
        {
          headers: {
            Referer: "https://kazora.cc/",
            Origin: "https://kazora.cc",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
          },
          signal: AbortSignal.timeout(3e3)
        }
      );
      if (checkRes.ok) {
        return { status: 200, data: { hasDub: true } };
      }
      return { status: 200, data: { hasDub: false } };
    } catch {
      return { status: 200, data: { hasDub: null } };
    }
  }
  const isAnime = rawType === "anime" || Boolean(title && /anime/i.test(title));
  const serverConfig = ALL_STREAM_SERVERS.find((s) => s.id === serverId);

  // Helper for single server resolution
  async function resolveTarget(targetId) {
    const cfg = ALL_STREAM_SERVERS.find((s) => s.id === targetId);

    // ── 1. Itachi (poseidon) — VAPlayer / Cloudfabric ──
    if (targetId === "poseidon" || targetId === "poseidon_anime") {
      let apiUrl = `https://streamdata.vaplayer.ru/api.php?tmdb=${tmdbId}&type=${type}`;
      if (type === "tv" || (isAnime && (Number(season) > 1 || Number(episode) > 1))) {
        apiUrl += `&season=${season}&episode=${episode}`;
      }
      try {
        const res = await fetch(apiUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Referer: "https://nextgencloudfabric.com/",
            Origin: "https://nextgencloudfabric.com"
          },
          signal: AbortSignal.timeout(10000)
        });
        if (res.ok) {
          const data = await res.json();
          const rawUrls = data?.data?.stream_urls || data?.stream_urls || [];
          if (rawUrls.length > 0) {
            const rawUrl = rawUrls[0];
            const returnedImdb = data?.data?.imdb_id || imdbId;
            let resolvedSubs = [];
            if (returnedImdb) {
              try {
                resolvedSubs = await Promise.race([
                  fetchPublicSubtitles(returnedImdb, type, season, episode),
                  new Promise((resolve) => setTimeout(() => resolve([]), 1200))
                ]);
              } catch {}
            }
            const proxiedUrl = `/api/stream/proxy?url=${encodeURIComponent(
              rawUrl
            )}&referer=${encodeURIComponent("https://nextgencloudfabric.com/")}&origin=${encodeURIComponent(
              "https://nextgencloudfabric.com"
            )}`;
            return {
              status: 200,
              data: {
                success: true,
                server: targetId,
                serverName: cfg?.name || "Itachi",
                mode: "hls",
                streamUrl: proxiedUrl,
                rawUrl,
                quality: "1080p Master HLS",
                subtitles: resolvedSubs.length > 0 ? resolvedSubs : data?.subtitles || data?.data?.default_subs || []
              }
            };
          }
        }
      } catch {}
      return { status: 200, data: { success: false, server: targetId, message: "No stream found in Itachi cluster" } };
    }

    // ── 2. Aomine (stellar_hls) — CineBros API ──
    if (targetId === "stellar_hls" || targetId === "stellar_miami" || targetId === "stellar_boise") {
      const cbResult = await resolveCineBrosStream(tmdbId, type, season, episode);
      if (cbResult?.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: cfg?.name ? `${cfg.name} (${cbResult.quality})` : cbResult.serverName,
            mode: "hls",
            streamUrl: cbResult.streamUrl,
            rawUrl: cbResult.rawUrl,
            subtitles: cbResult.subtitles || [],
            quality: cbResult.quality,
            is4k: cbResult.is4k
          }
        };
      }
      // Cascade to Cinejoy Nebula
      try {
        const cjResult = await resolveCinejoyStream("nebula", tmdbId, type, season, episode, title, year);
        if (cjResult?.streamUrl) {
          return {
            status: 200,
            data: {
              success: true,
              server: targetId,
              serverName: `Aomine (Cinejoy Failover)`,
              mode: "hls",
              streamUrl: cjResult.streamUrl,
              subtitles: cjResult.subtitles || [],
              quality: cjResult.quality || "1080p Master HLS",
              is4k: cjResult.is4k
            }
          };
        }
      } catch {}

      // Cascade to legacy Stellar stream
      const targetSubServer = targetId === "stellar_boise" ? "boise" : targetId === "stellar_miami" ? "miami" : "auto";
      const stellarResult = await resolveStellarStream(targetSubServer, tmdbId, type, season, episode);
      if (stellarResult?.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            mode: "hls",
            serverName: stellarResult.server,
            streamUrl: stellarResult.streamUrl,
            subtitles: stellarResult.subtitles || [],
            quality: stellarResult.quality,
            is4k: stellarResult.is4k
          }
        };
      }
      return { status: 200, data: { success: false, server: targetId, message: "No stream found in Aomine / CineBros cluster" } };
    }

    // ── 3. Obito (vixsrc_hls) — Hybrid Failover (Citadel -> Cinejoy Nebula) ──
    if (targetId === "vixsrc_hls") {
      // Step A: Rivestream Citadel
      try {
        const riveResult = await resolveRivestreamProvider("citadel", tmdbId, type, season, episode);
        if (riveResult.success && riveResult.streamUrl) {
          return {
            status: 200,
            data: {
              success: true,
              server: targetId,
              serverName: "Obito (Citadel Multi-Audio)",
              mode: "hls",
              streamUrl: riveResult.streamUrl,
              subtitles: riveResult.subtitles || [],
              quality: riveResult.quality || "720p / 1080p",
              supportsDualAudio: true
            }
          };
        }
      } catch {}

      // Step B: Cinejoy Nebula
      try {
        const cjResult = await resolveCinejoyStream("nebula", tmdbId, type, season, episode, title, year);
        if (cjResult?.streamUrl) {
          return {
            status: 200,
            data: {
              success: true,
              server: targetId,
              serverName: "Obito (Cinejoy Nebula)",
              mode: "hls",
              streamUrl: cjResult.streamUrl,
              subtitles: cjResult.subtitles || [],
              quality: cjResult.quality || "1080p Master HLS",
              supportsDualAudio: true
            }
          };
        }
      } catch {}

      // Step C: MovieNight failover
      const mnResult = await resolveMovieNightStream(tmdbId, type, season, episode, title, "vixsrc-1", imdbId, year);
      if (mnResult.success && mnResult.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: `Obito (${mnResult.server})`,
            mode: "hls",
            streamUrl: mnResult.streamUrl,
            subtitles: mnResult.subtitles || [],
            quality: mnResult.quality || "auto",
            supportsDualAudio: true
          }
        };
      }
      return { status: 200, data: { success: false, server: targetId, message: "No stream found in Obito cluster" } };
    }

    // ── 4. Madara (salem_hls) — Cinejoy API Cluster ──
    if (targetId === "salem_hls") {
      try {
        const cjResult = await resolveCinejoyStream("nebula", tmdbId, type, season, episode, title, year);
        if (cjResult?.streamUrl) {
          return {
            status: 200,
            data: {
              success: true,
              server: targetId,
              serverName: "Madara (Cinejoy Nebula)",
              mode: "hls",
              streamUrl: cjResult.streamUrl,
              subtitles: cjResult.subtitles || [],
              quality: cjResult.quality || "1080p Master HLS"
            }
          };
        }
      } catch {}
      const mnResult = await resolveMovieNightStream(tmdbId, type, season, episode, title, "salem", imdbId, year);
      if (mnResult.success && mnResult.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: `Madara (${mnResult.server})`,
            mode: "hls",
            streamUrl: mnResult.streamUrl,
            subtitles: mnResult.subtitles || [],
            quality: mnResult.quality || "auto"
          }
        };
      }
      return { status: 200, data: { success: false, server: targetId, message: "No stream found in Madara cluster" } };
    }

    // ── 5. Minato (movienight_auto) — Cinejoy API Cluster Auto ──
    if (targetId === "movienight_auto" || targetId === "movienight") {
      try {
        const cjResult = await resolveCinejoyStream("auto", tmdbId, type, season, episode, title, year);
        if (cjResult?.streamUrl) {
          return {
            status: 200,
            data: {
              success: true,
              server: targetId,
              serverName: `Minato (${cjResult.server})`,
              mode: "hls",
              streamUrl: cjResult.streamUrl,
              subtitles: cjResult.subtitles || [],
              quality: cjResult.quality || "1080p Master HLS",
              supportsDualAudio: true
            }
          };
        }
      } catch {}
      const mnResult = await resolveMovieNightStream(tmdbId, type, season, episode, title, void 0, imdbId, year);
      if (mnResult.success && mnResult.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: `Minato (${mnResult.server})`,
            mode: "hls",
            streamUrl: mnResult.streamUrl,
            subtitles: mnResult.subtitles || [],
            quality: mnResult.quality || "auto",
            supportsDualAudio: true
          }
        };
      }
      return { status: 200, data: { success: false, server: targetId, message: "No stream found in Minato cluster" } };
    }

    // ── 6. Rivestream Cluster: Luffy (rive_citadel), L (rive_vanguard), Tanjiro (atlantia) ──
    if (targetId === "atlantia" || targetId.startsWith("rive_")) {
      const preferredProvider = targetId === "rive_vanguard" ? "vanguard" : targetId === "rive_citadel" ? "citadel" : (targetId === "rive_mirage" || targetId === "atlantia") ? "mirage" : void 0;
      const mediaType = type === "tv" ? "tv" : "movie";
      let riveResult = preferredProvider
        ? await resolveRivestreamProvider(preferredProvider, tmdbId, mediaType, season, episode)
        : await resolveRivestreamStream(tmdbId, mediaType, season, episode);
      if (!riveResult.success && preferredProvider) {
        riveResult = await resolveRivestreamStream(tmdbId, mediaType, season, episode);
      }
      if (riveResult.success && riveResult.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: cfg?.name || targetId,
            mode: "hls",
            streamUrl: riveResult.streamUrl,
            rawUrl: riveResult.rawUrl,
            subtitles: riveResult.subtitles || [],
            quality: riveResult.quality || "1080p Master HLS",
            activeProvider: riveResult.provider,
            supportsDualAudio: targetId === "rive_citadel" || riveResult.provider === "citadel"
          }
        };
      }
      return {
        status: 200,
        data: {
          success: false,
          server: targetId,
          message: riveResult.error || `No active stream found in ${cfg?.name || "Rivestream"} cluster`
        }
      };
    }

    // ── 7. Killua (vidzee) — VidZee FastCloud API ──
    if (targetId === "vidzee") {
      const vidzeeResult = await resolveVidZee(
        tmdbId,
        type === "tv" ? "tv" : "movie",
        parseInt(season, 10) || 1,
        parseInt(episode, 10) || 1
      );
      if (vidzeeResult.success && vidzeeResult.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: cfg?.name || "Killua",
            mode: "hls",
            streamUrl: vidzeeResult.streamUrl,
            rawUrl: vidzeeResult.rawUrl,
            subtitles: vidzeeResult.subtitles || [],
            quality: vidzeeResult.quality || "1080p FastCloud HLS"
          }
        };
      }
      return { status: 200, data: { success: false, server: targetId, message: vidzeeResult.error || "No stream found in VidZee cluster" } };
    }

    // ── 8. Kakashi (orion) — 7movies / Vidrift Token Gateway ──
    if (targetId === "orion") {
      const isTv = type === "tv";
      const numTmdb = Number(tmdbId);
      const pageReferer = isTv ? `https://7movies.ac/tv/${numTmdb}/watch?season=${season}&episode=${episode}` : `https://7movies.ac/movie/${numTmdb}/watch`;
      try {
        const tokenRes = await fetch("https://7movies.ac/api/playback-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Referer: pageReferer,
            Origin: "https://7movies.ac",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
          },
          body: JSON.stringify(
            isTv ? { tmdbId: numTmdb, type, season: Number(season), episode: Number(episode) } : { tmdbId: numTmdb, type }
          ),
          signal: AbortSignal.timeout(3500)
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          const token = tokenData?.token || tokenData?.data?.token;
          if (token) {
            const path3 = isTv ? `tv/${numTmdb}/${season}/${episode}` : `movie/${numTmdb}`;
            const sourceRes = await fetch(
              `https://embed.vidrift.net/api/source/${path3}?token=${token}&provider=moviebox`,
              {
                headers: {
                  Referer: "https://embed.vidrift.net/",
                  Origin: "https://embed.vidrift.net",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                },
                signal: AbortSignal.timeout(3500)
              }
            );
            if (sourceRes.ok) {
              const sourceData = await sourceRes.json();
              const rawStream = sourceData?.data?.source || sourceData?.source;
              if (rawStream) {
                const proxiedUrl = `/api/stream/proxy?url=${encodeURIComponent(
                  rawStream
                )}&referer=${encodeURIComponent("https://embed.vidrift.net/")}&origin=${encodeURIComponent(
                  "https://embed.vidrift.net"
                )}`;
                return {
                  status: 200,
                  data: {
                    success: true,
                    server: targetId,
                    serverName: cfg?.name || "Kakashi",
                    mode: "hls",
                    streamUrl: proxiedUrl,
                    quality: "1080p Master HLS",
                    subtitles: sourceData?.subtitles || [],
                    supportsDualAudio: true
                  }
                };
              }
            }
          }
        }
      } catch {}
      return { status: 200, data: { success: false, server: targetId, message: "No stream found in Orion cluster" } };
    }

    // ── 9. Sasuke (purstream) — PurStream Search Gateway ──
    if (targetId === "purstream") {
      const cleanTitle = (title || "").replace(/[^a-zA-Z0-9\s]/g, "").trim();
      if (!cleanTitle) {
        return { status: 200, data: { success: false, server: targetId, message: "Missing title" } };
      }
      try {
        const searchRes = await fetch(
          `https://api.purstream.ad/api/v1/search-bar/search/${encodeURIComponent(cleanTitle)}`,
          {
            headers: {
              Referer: "https://purstream.ad/",
              Origin: "https://purstream.ad",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            },
            signal: AbortSignal.timeout(4000)
          }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const movies = searchData?.data?.items?.movies?.items || [];
          const shows = searchData?.data?.items?.shows?.items || [];
          const items = type === "tv" ? (shows.length ? shows : movies) : (movies.length ? movies : shows);
          if (items.length > 0) {
            const item = items[0];
            const streamEndpoint = type === "tv" ? `https://api.purstream.ad/api/v1/stream/${item.id}/episode?season=${season}&episode=${episode}` : `https://api.purstream.ad/api/v1/stream/${item.id}`;
            const streamRes = await fetch(streamEndpoint, {
              headers: {
                Referer: "https://purstream.ad/",
                Origin: "https://purstream.ad"
              },
              signal: AbortSignal.timeout(4000)
            });
            if (streamRes.ok) {
              const streamData = await streamRes.json();
              const sources = streamData?.data?.items?.sources || [];
              const rawUrl = sources[0]?.stream_url || streamData?.data?.stream || streamData?.stream;
              if (rawUrl) {
                const proxiedUrl = `/api/stream/proxy?url=${encodeURIComponent(
                  rawUrl
                )}&referer=${encodeURIComponent("https://purstream.ad/")}&origin=${encodeURIComponent("https://purstream.ad")}`;
                return {
                  status: 200,
                  data: {
                    success: true,
                    server: targetId,
                    serverName: cfg?.name || "Sasuke",
                    mode: "hls",
                    streamUrl: proxiedUrl,
                    quality: sources[0]?.source_name || "1080p Master HLS",
                    subtitles: streamData?.subtitles || []
                  }
                };
              }
            }
          }
        }
      } catch {}
      return { status: 200, data: { success: false, server: targetId, message: "No stream found in PurStream cluster" } };
    }

    // ── 10. Cinejoy Clusters: Mikasa (cinejoy_nebula), Hashirama (cinejoy_hls), Naruto (cinejoy_lisbon) ──
    if (targetId === "cinejoy_hls" || targetId === "cinejoy_lisbon" || targetId === "cinejoy_nebula") {
      const targetSubServer = targetId === "cinejoy_lisbon" ? "lisbon" : targetId === "cinejoy_nebula" ? "nebula" : "auto";
      const cinejoyResult = await resolveCinejoyStream(targetSubServer, tmdbId, type, season, episode, title);
      if (cinejoyResult?.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            mode: "hls",
            serverName: cinejoyResult.server,
            streamUrl: cinejoyResult.streamUrl,
            subtitles: cinejoyResult.subtitles || [],
            quality: cinejoyResult.quality,
            is4k: cinejoyResult.is4k
          }
        };
      }
      return { status: 200, data: { success: false, server: targetId, message: "No stream found in Cinejoy cluster" } };
    }

    // ── 11. Eren (shiopa_hls) ──
    if (targetId === "shiopa_hls") {
      const shiopaResult = await resolveShiopaStream(tmdbId, type, season, episode);
      if (shiopaResult?.streamUrl) {
        const proxiedStreamUrl = `/api/stream/proxy?url=${encodeURIComponent(shiopaResult.streamUrl)}${shiopaResult.headers?.Referer ? `&referer=${encodeURIComponent(shiopaResult.headers.Referer)}` : ""}`;
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            mode: "hls",
            serverName: `Eren (${shiopaResult.server})`,
            streamUrl: proxiedStreamUrl
          }
        };
      }
      return { status: 200, data: { success: false, server: targetId, message: "No stream found in Shiopa cluster" } };
    }

    // ── 12. Kazora Anime Clusters: Female Titan (kazo_anime), Toji (kyoo_anime), Levi (juju_anime), Goku (lufi_anime) ──
    if (targetId === "kazo_anime" || targetId === "kyoo_anime" || targetId === "juju_anime" || targetId === "lufi_anime") {
      const audioMode = audio === "dub" ? "dub" : "sub";
      const anilistId = searchParams.get("anilistId") || await resolveAnilistId(title, rawTmdbId);
      if (anilistId) {
        const kzResult = await resolveKazoraStream(targetId, anilistId, episode, audioMode);
        if (kzResult?.streamUrl) {
          return {
            status: 200,
            data: {
              ...kzResult,
              serverName: cfg?.name || kzResult.serverName,
              audioType: audioMode
            }
          };
        }
      }
      // Failover to KAA
      const kaa = await resolveKAAStream(title, episode, audioMode);
      if (kaa?.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: `${cfg?.name || "Kazora"} (KAA Fallback)`,
            mode: "hls",
            streamUrl: kaa.streamUrl,
            subtitles: kaa.subtitles || [],
            quality: kaa.quality || "1080p Master HLS",
            hasDub: true,
            supportsDualAudio: true,
            audioType: audioMode
          }
        };
      }
      // Failover to AnimeParadise
      const ap = await resolveAnimeParadise(title, parseInt(episode, 10) || 1);
      if (ap?.success && ap.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: `${cfg?.name || "Kazora"} (AnimeParadise Fallback)`,
            mode: "hls",
            streamUrl: ap.streamUrl,
            subtitles: ap.subtitles || [],
            quality: ap.quality || "1080p FHD",
            hasDub: false,
            supportsDualAudio: false,
            audioType: audioMode,
            skipData: ap.skipData
          }
        };
      }
      return { status: 200, data: { success: false, server: targetId, message: `No stream found on ${cfg?.name || targetId} cluster` } };
    }

    // ── 13. Shisui (miruro_anime) ──
    if (targetId === "miruro_anime") {
      const audioMode = audio === "dub" ? "dub" : "sub";
      let miruroResult = await resolveMiruroStream(title, episode, audioMode);
      if (!miruroResult?.streamUrl) {
        const anilistId = searchParams.get("anilistId") || await resolveAnilistId(title, rawTmdbId);
        if (anilistId) {
          const kz = await resolveKazoraStream("kazora", anilistId, episode, audioMode);
          if (kz?.streamUrl) {
            miruroResult = {
              streamUrl: kz.streamUrl,
              server: "Shisui (Kazora)",
              provider: "kazora",
              subtitles: kz.subtitles || [],
              quality: kz.quality || "1080p Master HLS",
              hasDub: kz.hasDub
            };
          }
        }
      }
      if (!miruroResult?.streamUrl) {
        const kaa = await resolveKAAStream(title, episode, audioMode);
        if (kaa?.streamUrl) {
          miruroResult = {
            streamUrl: kaa.streamUrl,
            server: "Shisui (KAA)",
            provider: "kaa",
            subtitles: kaa.subtitles || [],
            quality: kaa.quality || "1080p Master HLS",
            hasDub: true
          };
        }
      }
      if (!miruroResult?.streamUrl) {
        const ap = await resolveAnimeParadise(title, parseInt(episode, 10) || 1);
        if (ap?.success && ap.streamUrl) {
          miruroResult = {
            streamUrl: ap.streamUrl,
            server: "Shisui (AnimeParadise)",
            provider: "animeparadise",
            subtitles: ap.subtitles || [],
            quality: ap.quality || "1080p FHD",
            hasDub: false
          };
        }
      }
      if (miruroResult?.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: cfg?.name || "Shisui",
            mode: "hls",
            streamUrl: miruroResult.streamUrl,
            subtitles: miruroResult.subtitles || [],
            quality: miruroResult.quality || "1080p",
            hasDub: miruroResult.hasDub ?? true,
            supportsDualAudio: true,
            audioType: audioMode
          }
        };
      }
      return { status: 200, data: { success: false, server: targetId, message: "No stream found on Shisui anime cluster" } };
    }

    // ── 14. Yuji (kaa_anime) — KickAssAnime Direct Master HLS ──
    if (targetId === "kaa_anime") {
      const kaaResult = await resolveKAAStream(title, episode, audio);
      if (kaaResult?.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: kaaResult.serverName,
            mode: "hls",
            streamUrl: kaaResult.streamUrl,
            subtitles: kaaResult.subtitles || [],
            quality: kaaResult.quality || "1080p Master HLS",
            hasDub: true,
            supportsDualAudio: true,
            audioType: audio
          }
        };
      }
      // Failover to Kazora
      const anilistId = searchParams.get("anilistId") || await resolveAnilistId(title, rawTmdbId);
      if (anilistId) {
        const kz = await resolveKazoraStream("kazora", anilistId, episode, audio);
        if (kz?.streamUrl) {
          return {
            status: 200,
            data: {
              ...kz,
              server: targetId,
              serverName: `${cfg?.name || "Yuji"} (Kazora Fallback)`,
              audioType: audio
            }
          };
        }
      }
      const ap = await resolveAnimeParadise(title, parseInt(episode, 10) || 1);
      if (ap?.success && ap.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: cfg?.name || "Yuji",
            mode: "hls",
            streamUrl: ap.streamUrl,
            subtitles: ap.subtitles || [],
            quality: ap.quality || "1080p FHD",
            hasDub: false,
            supportsDualAudio: false,
            audioType: audio
          }
        };
      }
      return { status: 200, data: { success: false, server: targetId, message: "No stream found in KickAssAnime cluster" } };
    }

    // ── 15. Tengen (orion_anime) ──
    if (targetId === "orion_anime") {
      const audioMode = audio === "dub" ? "dub" : "sub";
      const anilistId = searchParams.get("anilistId") || await resolveAnilistId(title, rawTmdbId);
      if (anilistId) {
        const kz = await resolveKazoraStream("yuri", anilistId, episode, audioMode);
        if (kz?.streamUrl) {
          return {
            status: 200,
            data: {
              ...kz,
              server: targetId,
              serverName: cfg?.name || "Tengen",
              audioType: audioMode
            }
          };
        }
      }
      const kaa = await resolveKAAStream(title, episode, audioMode);
      if (kaa?.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: cfg?.name || "Tengen",
            mode: "hls",
            streamUrl: kaa.streamUrl,
            subtitles: kaa.subtitles || [],
            quality: kaa.quality || "1080p Master HLS",
            hasDub: true,
            supportsDualAudio: true,
            audioType: audioMode
          }
        };
      }
      return { status: 200, data: { success: false, server: targetId, message: "No stream found in Tengen cluster" } };
    }

    // ── 16. AnimeParadise (animeparadise) — Crunchyroll Native Scraper Gateway ──
    if (targetId === "animeparadise") {
      const animeResult = await resolveAnimeParadise(title, parseInt(episode, 10) || 1);
      if (animeResult.success && animeResult.streamUrl) {
        return {
          status: 200,
          data: {
            success: true,
            server: targetId,
            serverName: cfg?.name || "AnimeParadise",
            mode: "hls",
            streamUrl: animeResult.streamUrl,
            rawUrl: animeResult.rawUrl,
            subtitles: animeResult.subtitles || [],
            quality: animeResult.quality,
            skipData: animeResult.skipData
          }
        };
      }
      // Failover to Kazora
      const anilistId = searchParams.get("anilistId") || await resolveAnilistId(title, rawTmdbId);
      if (anilistId) {
        const kz = await resolveKazoraStream("kazora", anilistId, episode, audio);
        if (kz?.streamUrl) {
          return {
            status: 200,
            data: {
              ...kz,
              server: targetId,
              serverName: `${cfg?.name || "AnimeParadise"} (Kazora Fallback)`,
              audioType: audio
            }
          };
        }
      }
      return { status: 200, data: { success: false, server: targetId, message: animeResult.error || "No stream found in Anime Paradise cluster" } };
    }

    return { status: 200, data: { success: false, server: targetId, message: "Server returned no playable source" } };
  }

  try {
    // If server is 'auto' or not explicitly provided, try priority chain
    if (serverId === "auto" || (!searchParams.has("server") && !searchParams.has("serverId"))) {
      const chain = isAnime
        ? ["miruro_anime", "kazo_anime", "kaa_anime", "animeparadise", "kyoo_anime", "juju_anime", "lufi_anime", "poseidon_anime"]
        : ["poseidon", "stellar_hls", "vixsrc_hls", "salem_hls", "purstream", "rive_citadel", "rive_vanguard", "atlantia", "movienight_auto", "cinejoy_nebula"];
      for (const sid of chain) {
        try {
          const res = await resolveTarget(sid);
          if (res.status === 200 && res.data?.success && res.data?.streamUrl) {
            return res;
          }
        } catch {}
      }
      return { status: 200, data: { success: false, server: "auto", message: "All priority streaming servers failed to resolve" } };
    }

    return await resolveTarget(serverId);
  } catch (error) {
    return {
      status: 500,
      data: {
        success: false,
        server: serverId,
        message: error instanceof Error ? error.message : "Resolution timeout or network error"
      }
    };
  }
}
async function handler(request, response) {
  try {
    if (request.method === "OPTIONS") {
      if (response && typeof response.setHeader === "function") {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "*");
        response.statusCode = 204;
        return response.end();
      }
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }
    if (response && (typeof response.status === "function" || typeof response.setHeader === "function")) {
      const host = request.headers?.host || "localhost:5173";
      const fullUrl2 = new URL(request.url || "/", `http://${host}`);
      const searchParams = fullUrl2.searchParams;
      if (request.query && typeof request.query === "object") {
        for (const [k, v] of Object.entries(request.query)) {
          if (typeof v === "string" && !searchParams.has(k)) {
            searchParams.set(k, v);
          }
        }
      }
      const result2 = routeResultThroughVps(await handleResolve(searchParams));
      response.setHeader("Content-Type", "application/json");
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      if (result2.data?.success && result2.data?.streamUrl) {
        response.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      }
      if (typeof response.status === "function" && typeof response.json === "function") {
        return response.status(result2.status).json(result2.data);
      } else {
        response.statusCode = result2.status;
        return response.end(JSON.stringify(result2.data));
      }
    }
    const fullUrl = new URL(request.url, "http://localhost");
    const result = routeResultThroughVps(await handleResolve(fullUrl.searchParams));
    return new Response(JSON.stringify(result.data), {
      status: result.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        ...(result.data?.success && result.data?.streamUrl ? { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } : {})
      }
    });
  } catch (err) {
    console.error("FATAL_RESOLVE_ERROR:", err);
    const errPayload = {
      success: false,
      error: err?.message || String(err),
      stack: err?.stack
    };
    if (response) {
      if (typeof response.setHeader === "function") {
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Access-Control-Allow-Origin", "*");
      }
      if (typeof response.status === "function" && typeof response.json === "function") {
        return response.status(200).json(errPayload);
      }
      response.statusCode = 200;
      return response.end(JSON.stringify(errPayload));
    }
    return new Response(JSON.stringify(errPayload), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
export {
  handler as default
};
