export const config = {
  runtime: "edge",
};

export default async function handler(request: Request | any, response?: any) {
  // If invoked with Node req/res, construct standard Request/Response or handle directly
  if (response && (typeof response.status === "function" || typeof response.setHeader === "function")) {
    const host = request.headers?.host || "localhost:5173";
    const fullUrl = new URL(request.url, `http://${host}`);
    const webReq = new Request(fullUrl.toString(), {
      method: request.method || "GET",
      headers: request.headers,
    });
    const webRes = await handleProxy(webReq);
    if (typeof response.status === "function") {
      response.status(webRes.status);
    } else {
      response.statusCode = webRes.status;
    }
    webRes.headers.forEach((value: string, key: string) => {
      response.setHeader(key, value);
    });
    if (webRes.body) {
      const reader = webRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        response.write(value);
      }
      return response.end();
    }
    return response.end();
  }

  return handleProxy(request);
}

export async function GET(request: Request) {
  return handleProxy(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

function decodeBase64Safe(val: string): string {
  try {
    const b64 = val.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    if (typeof atob === "function") {
      const bin = atob(padded);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
  } catch {}
  return "";
}

async function handleProxy(request: Request): Promise<Response> {
  const fullUrl = new URL(request.url, "http://localhost");
  const { searchParams } = fullUrl;
  let targetUrl = searchParams.get("url");

  let parsedHeaders: Record<string, string> = {};
  const hParam = searchParams.get("h");
  if (hParam) {
    try {
      const decodedH = decodeBase64Safe(hParam);
      if (decodedH) {
        parsedHeaders = JSON.parse(decodedH);
      }
    } catch {}
  }

  if (!targetUrl && searchParams.get("u")) {
    const decodedU = decodeBase64Safe(searchParams.get("u")!);
    if (decodedU && /^https?:\/\//i.test(decodedU)) {
      targetUrl = decodedU;
    }
  }

  const referer =
    searchParams.get("referer") ||
    parsedHeaders["Referer"] ||
    parsedHeaders["referer"] ||
    "https://nextgencloudfabric.com/";
  const origin =
    searchParams.get("origin") ||
    parsedHeaders["Origin"] ||
    parsedHeaders["origin"] ||
    "https://nextgencloudfabric.com";

  if (!targetUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: referer,
      Origin: origin,
    };

    for (const [k, v] of Object.entries(parsedHeaders)) {
      const lk = k.toLowerCase();
      if (lk !== "referer" && lk !== "origin" && lk !== "user-agent" && typeof v === "string" && v) {
        upstreamHeaders[k] = v;
      }
    }

    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      upstreamHeaders["Range"] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers: upstreamHeaders,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return new Response(`Upstream failed: ${upstreamRes.status}`, {
        status: upstreamRes.status,
      });
    }

    const contentType = upstreamRes.headers.get("content-type") || "";
    const lowerContentType = contentType.toLowerCase();
    const lowerTargetUrl = targetUrl.toLowerCase();

    // Check if it's an M3U8 playlist
    const isPlaylist =
      lowerTargetUrl.includes(".m3u8") ||
      lowerTargetUrl.includes("/m3u8") ||
      lowerTargetUrl.includes("m3u8") ||
      lowerTargetUrl.includes("/manifest/") ||
      lowerTargetUrl.includes("/uwu/") ||
      lowerContentType.includes("application/vnd.apple.mpegurl") ||
      lowerContentType.includes("application/x-mpegurl") ||
      lowerContentType.includes("audio/x-mpegurl") ||
      (!lowerContentType.includes("video/mp2t") &&
        (lowerTargetUrl.includes("playlist") || lowerTargetUrl.includes("master"))) ||
      /\/playlist\.(jpg|png|jpeg)(\?|$)/i.test(targetUrl) ||
      /\/master\.(jpg|png|jpeg)(\?|$)/i.test(targetUrl);

    // Check if it's WebVTT or SRT subtitle
    const isSubtitle =
      targetUrl.includes(".vtt") ||
      targetUrl.includes(".srt") ||
      contentType.includes("text/vtt") ||
      contentType.includes("application/x-subrip");

    if (isPlaylist) {
      const text = await upstreamRes.text();
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

      // If it is a master playlist, sort variants by bandwidth descending so 1080p is selected first
      let lines = text.split("\n");
      if (text.includes("#EXT-X-STREAM-INF:")) {
        const headers: string[] = [];
        const variants: Array<{ inf: string; uri: string; bw: number }> = [];
        let i = 0;
        while (i < lines.length) {
          const l = lines[i].trim();
          if (l.startsWith("#EXT-X-STREAM-INF:")) {
            const uri = i + 1 < lines.length ? lines[i + 1].trim() : "";
            let bw = 0;
            const match = l.match(/BANDWIDTH=(\d+)/);
            if (match) bw = parseInt(match[1], 10);
            variants.push({ inf: l, uri, bw });
            i += 2;
          } else {
            headers.push(lines[i]);
            i++;
          }
        }
        // Sort variants so stable 1080p is preferred over heavy 4K
        variants.sort((a, b) => {
          const isA1080 = a.bw >= 2500000 && a.bw <= 9500000;
          const isB1080 = b.bw >= 2500000 && b.bw <= 9500000;
          if (isA1080 && !isB1080) return -1;
          if (!isA1080 && isB1080) return 1;
          return b.bw - a.bw;
        });
        const sortedLines = [...headers];
        for (const v of variants) {
          sortedLines.push(v.inf);
          sortedLines.push(v.uri);
        }
        lines = sortedLines;
      }

      const hQuery = hParam ? `&h=${encodeURIComponent(hParam)}` : "";

      // Rewrite each URI in the playlist
      const rewrittenLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/, (_match, p1) => {
              const fullUri = p1.startsWith("http")
                ? p1
                : p1.startsWith("//")
                ? `https:${p1}`
                : p1.startsWith("/")
                ? `${new URL(targetUrl).origin}${p1}`
                : `${baseUrl}${p1}`;
              const proxied = `/api/stream/proxy?url=${encodeURIComponent(
                fullUri
              )}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}${hQuery}`;
              return `URI="${proxied}"`;
            });
          }
          return line;
        }

        // Segment or sub-playlist URL
        const fullSegmentUrl = trimmed.startsWith("http")
          ? trimmed
          : trimmed.startsWith("//")
          ? `https:${trimmed}`
          : trimmed.startsWith("/")
          ? `${new URL(targetUrl).origin}${trimmed}`
          : `${baseUrl}${trimmed}`;

        return `/api/stream/proxy?url=${encodeURIComponent(
          fullSegmentUrl
        )}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}${hQuery}`;
      });

      return new Response(rewrittenLines.join("\n"), {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Cache-Control": "public, max-age=5, s-maxage=30",
          "Cloudflare-CDN-Cache-Control": "public, max-age=30",
        },
      });
    }

    if (isSubtitle) {
      let text = await upstreamRes.text();
      if (!text.startsWith("WEBVTT")) {
        text =
          "WEBVTT\n\n" +
          text
            .replace(/\r\n|\r/g, "\n")
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
      }
      return new Response(text, {
        headers: {
          "Content-Type": "text/vtt; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    }

    // Binary media segments (.ts, .mp4, init.mp4, etc.) with 0 RAM buffering
    const lowerUrl = targetUrl.toLowerCase();
    const isFmp4 =
      lowerUrl.includes("bright67.online") ||
      lowerUrl.includes("init.") ||
      lowerUrl.includes(".mp4") ||
      lowerUrl.includes(".m4s") ||
      lowerUrl.includes("nebula") ||
      lowerUrl.includes("lisbon") ||
      lowerUrl.includes("stellar") ||
      lowerUrl.includes("plumbingservice");

    let segmentContentType = isFmp4 ? "video/mp4" : "video/mp2t";
    if (
      contentType &&
      !contentType.startsWith("image/") &&
      !contentType.startsWith("text/") &&
      !contentType.includes("octet-stream")
    ) {
      segmentContentType = contentType;
    }

    const forwardHeaders: Record<string, string> = {
      "Content-Type": segmentContentType,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
      "Cloudflare-CDN-Cache-Control": "public, max-age=604800, immutable",
      "CDN-Cache-Control": "public, max-age=604800, immutable",
    };

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) forwardHeaders["Content-Length"] = contentLength;

    const acceptRanges = upstreamRes.headers.get("accept-ranges");
    if (acceptRanges) forwardHeaders["Accept-Ranges"] = acceptRanges;

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) forwardHeaders["Content-Range"] = contentRange;

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: forwardHeaders,
    });
  } catch (error) {
    return new Response(
      `Proxy error: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 }
    );
  }
}
