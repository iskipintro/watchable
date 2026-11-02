# Streamly Streaming Servers & Providers API Documentation

A comprehensive guide to all native streaming clusters, upstream providers, endpoints, and headers utilized by Streamly. This document can be used to integrate these sources into any third-party website, player, or backend service.

---

## Table of Contents
1. [Option 1: Streamly Unified Resolver API (Recommended)](#option-1-streamly-unified-resolver-api-recommended)
2. [Option 2: Direct Upstream Movie & TV Series Servers](#option-2-direct-upstream-movie--tv-series-servers)
3. [Option 3: Direct Upstream Anime Servers (Dub & Sub)](#option-3-direct-upstream-anime-servers-dub--sub)
4. [CORS & Header Spoofing Architecture](#cors--header-spoofing-architecture)
5. [Integration Code Examples (JavaScript / TypeScript)](#integration-code-examples)

---

## Option 1: Streamly Unified Resolver API (Recommended)

Instead of building 20+ separate reverse-engineered scrapers on your external site, your server or frontend can query Streamly's unified resolver route. It returns pre-authenticated, ready-to-play `.m3u8` master playlists with subtitles and audio tracks.

### Endpoint
`GET https://streamlyfun.in/api/stream/resolve`

### Query Parameters

| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `tmdbId` | `string` / `number` | **Yes** | TMDB ID of the title | `157336` (Interstellar) |
| `type` | `string` | **Yes** | Media type (`movie` or `tv`) | `movie` |
| `server` | `string` | Optional | Specific server ID to query (defaults to best available) | `poseidon` |
| `season` | `number` | For TV | Season number | `1` |
| `episode` | `number` | For TV | Episode number | `1` |
| `title` | `string` | Recommended | Movie / Series Title | `Interstellar` |
| `audio` | `string` | For Anime | Anime audio track preference: `sub` or `dub` | `sub` |

### Sample Response (`200 OK`)
```json
{
  "success": true,
  "server": "poseidon",
  "serverName": "Itachi",
  "mode": "hls",
  "streamUrl": "https://streamlyfun.in/api/stream/proxy?token=...",
  "quality": "1080p Master HLS",
  "subtitles": [
    {
      "label": "English",
      "lang": "en",
      "url": "https://streamlyfun.in/api/stream/proxy?token=...",
      "default": true
    }
  ],
  "supportsDualAudio": false
}
```

---

## Option 2: Direct Upstream Movie & TV Series Servers

If you prefer querying the upstream scrapers directly from your own backend:

### 1. Itachi (`poseidon`)
* **Provider:** VAPlayer / Cloudfabric
* **Method:** `GET`
* **URL:** `https://streamdata.vaplayer.ru/api.php?tmdb={tmdbId}&type={type}`
  *(For TV: append `&season={season}&episode={episode}`)*
* **Headers:**
  ```http
  Referer: https://nextgencloudfabric.com/
  Origin: https://nextgencloudfabric.com
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36
  ```
* **Output:** JSON object containing `data.stream_urls` (Direct HLS master playlist).

---

### 2. Luffy (`rive_citadel`) — Multi-Audio Tracks
* **Provider:** Rivestream Citadel
* **Method:** `GET`
* **URL:** `https://scrapper.rivestream.app/api/provider?provider=citadel&id={tmdbId}`
  *(For TV: append `&season={season}&episode={episode}`)*
* **Headers:**
  ```http
  Referer: https://www.rivestream.app/
  Origin: https://www.rivestream.app
  Accept: application/json, text/plain, */*
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36
  ```
* **Output:** JSON with multiple audio tracks (Hindi, English, Tamil, Telugu, Spanish) and VTT captions.

---

### 3. L (`rive_vanguard`) — 4K UHD Master
* **Provider:** Rivestream Vanguard
* **Method:** `GET`
* **URL:** `https://scrapper.rivestream.app/api/provider?provider=vanguard&id={tmdbId}`
  *(For TV: append `&season={season}&episode={episode}`)*
* **Headers:** Same as Rivestream Citadel.
* **Output:** High bitrate 1080p / 4K UHD `.m3u8` master playlist.

---

### 4. Tanjiro (`atlantia`)
* **Provider:** Rivestream Mirage
* **Method:** `GET`
* **URL:** `https://scrapper.rivestream.app/api/provider?provider=mirage&id={tmdbId}`
  *(For TV: append `&season={season}&episode={episode}`)*
* **Headers:** Same as Rivestream Citadel.
* **Output:** High-performance direct CDN master stream.

---

### 5. Obito (`vixsrc_hls`)
* **Provider:** Hybrid Failover (Citadel $\rightarrow$ Cinejoy Nebula)
* **Method:** Queries Citadel first; if unavailable, cascades to Cinejoy Nebula.
* **Output:** Direct Multi-Audio HLS stream with subtitles.

---

### 6. Madara (`salem_hls`) & Minato (`movienight_auto`)
* **Provider:** Cinejoy API Cluster
* **Target:** `https://cinejoy.pk/`
* **Headers:**
  ```http
  Referer: https://cinejoy.pk/
  Origin: https://cinejoy.pk
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36
  ```
* **Output:** Sub-300ms lightning-fast direct master HLS playlist.

---

### 7. Killua (`vidzee`)
* **Provider:** VidZee / FastCloud API
* **Method:** `POST`
* **URL:** `https://core.vidzee.wtf/streams`
* **Payload:**
  ```json
  {
    "tmdbId": "157336",
    "type": "movie",
    "season": 1,
    "episode": 1
  }
  ```
* **Headers:**
  ```http
  Content-Type: application/json
  Referer: https://player.vidzee.wtf/
  Origin: https://player.vidzee.wtf
  ```
* **Output:** JSON with FastCloud 1080p / 720p HLS stream URLs.

---

### 8. Aomine (`stellar_hls`)
* **Provider:** CineBros API
* **Method:** `GET`
* **URL:** `https://cinebros.net/api/streams?tmdbId={tmdbId}&type={type}&seasonId={season}&episodeId={episode}`
* **Headers:**
  ```http
  Referer: https://cinebros.net/watch/movie/{tmdbId}
  Origin: https://cinebros.net
  ```
* **Output:** 1080p HLS stream with multi-language subtitle tracks.

---

### 9. Kakashi (`orion`)
* **Provider:** 7movies / Vidrift Token Gateway
* **Flow:**
  1. `POST https://7movies.ac/api/playback-token` with `{ "tmdbId": 157336, "type": "movie" }`
  2. Use returned token: `GET https://embed.vidrift.net/api/source/movie/{tmdbId}?token={token}&provider=moviebox`
* **Headers:**
  ```http
  Referer: https://7movies.ac/
  Origin: https://7movies.ac
  ```
* **Output:** Multi-audio stream playlist with full WebVTT subtitles.

---

### 10. Sasuke (`purstream`)
* **Provider:** PurStream Search Gateway
* **Method:** `GET`
* **URL:** `https://api.purstream.ad/api/v1/search-bar/search/{encodedTitle}`
* **Headers:**
  ```http
  Referer: https://purstream.ad/
  Origin: https://purstream.ad
  ```

---

## Option 3: Direct Upstream Anime Servers (Dub & Sub)

### 1. Yuji (`kaa_anime`) — English Dub & Japanese Audio
* **Provider:** KickAssAnime (KAA)
* **Method:** `POST`
* **URL:** `https://kaa.lt/api/fsearch` with `{"query": "Jujutsu Kaisen"}`
* **Stream Host:** Direct Master HLS delivered from `hls.krussdomi.com`
* **Features:** Full 1080p with both Japanese audio and English Dub options.

---

### 2. Shisui (`miruro_anime`) & Kazora Cluster
* **Clusters:**
  * `kazo_anime` (Female Titan)
  * `kyoo_anime` (Toji)
  * `juju_anime` (Levi)
  * `lufi_anime` (Goku)
* **Method:** `GET`
* **URL:** `https://kazora.cc/api/watch?id={aniListId}&ep={episode}&server={cluster}&type={sub_or_dub}`
* **Headers:**
  ```http
  Referer: https://kazora.cc/
  Origin: https://kazora.cc
  ```
* **Features:** Exact Intro / Outro skip timestamps, 8+ subtitle tracks, Sub & Dub toggles.

---

### 3. AnimeParadise (`animeparadise`)
* **Provider:** Crunchyroll Native Scraper Gateway
* **Search:** `GET https://api.animeparadise.moe/api/v1/anime/search?q={title}`
* **Stream Delivery:** `https://stream.animeparadise.moe/`
* **Headers:**
  ```http
  Referer: https://animeparadise.moe/
  Origin: https://animeparadise.moe
  ```
* **Features:** 1080p Crunchyroll raw streams with built-in OP/ED skip intervals.

---

## CORS & Header Spoofing Architecture

> [!WARNING]
> Upstream providers (such as Kazora, Rivestream, and Cinejoy) enforce strict CORS policies and validate the HTTP `Referer` and `Origin` headers. Standard browser `<video>` tags cannot send custom `Referer` headers.

### Required Architecture for Third-Party Websites:
```
[User Browser]
       │
       ▼ (HLS GET request)
[Your Backend Proxy]  ──(Attaches Referer & Origin)──▶  [Upstream CDN / Stream Server]
       │                                                         │
       ▼ (Pipes video stream back)                                │
[User Video Player]  ◀────────────────────────────────────────────┘
```

If you do not want to set up your own reverse proxy, simply call Streamly's endpoint (`https://streamlyfun.in/api/stream/resolve`), which handles header spoofing, proxying, and caching automatically.

---

## Integration Code Examples

### Example: Fetching a Stream from JavaScript / Node.js
```javascript
// Example: Resolving an HD stream for any movie on your external website
async function getMovieStream(tmdbId, title) {
  const url = new URL("https://streamlyfun.in/api/stream/resolve");
  url.searchParams.set("tmdbId", tmdbId);
  url.searchParams.set("type", "movie");
  url.searchParams.set("title", title);
  url.searchParams.set("server", "poseidon"); // or 'rive_citadel', 'salem_hls', etc.

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.success) {
    console.log("Playable Stream URL:", data.streamUrl);
    console.log("Subtitles:", data.subtitles);
    return data;
  } else {
    console.error("Resolution failed:", data.message);
    return null;
  }
}

// Example: Play in Hls.js
// hls.loadSource(data.streamUrl);
// hls.attachMedia(videoElement);
```

