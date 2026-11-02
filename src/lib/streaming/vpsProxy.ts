export const STREAM_PROXY_BASE =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://watchable-virid.vercel.app'

// Kept for backward compatibility with imports expecting VPS_ORIGIN
export const VPS_ORIGIN = STREAM_PROXY_BASE

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): string {
  try {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4
    const padded = pad ? b64 + '='.repeat(4 - pad) : b64
    const bin = atob(padded)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * Route any media or subtitle stream through the Vercel Edge stream proxy.
 * Completely eliminates dependency on external VPS.
 */
export function streamProxyUrl(
  rawUrl: string,
  headers?: Record<string, string>,
): string {
  if (!rawUrl) return rawUrl

  // Already using the Vercel stream proxy
  if (
    rawUrl.startsWith('/api/stream/proxy?') ||
    rawUrl.startsWith(`${STREAM_PROXY_BASE}/api/stream/proxy?`) ||
    rawUrl.includes('watchable-virid.vercel.app/api/stream/proxy?')
  ) {
    return rawUrl
  }

  // If this was an old VPS proxy URL or relative /proxy?, unwrap it
  if (
    rawUrl.includes('hahaevilcraft.site/proxy') ||
    rawUrl.startsWith('/proxy?') ||
    rawUrl.startsWith(`${STREAM_PROXY_BASE}/proxy?`)
  ) {
    try {
      const parsed = new URL(rawUrl, STREAM_PROXY_BASE)
      const urlParam = parsed.searchParams.get('url')
      const uParam = parsed.searchParams.get('u')
      let extractedUrl = urlParam || ''
      let mergedHeaders: Record<string, string> = { ...(headers || {}) }

      if (!extractedUrl && uParam) {
        extractedUrl = fromBase64Url(uParam)
      }

      const hParam = parsed.searchParams.get('h')
      if (hParam) {
        try {
          const parsedH = JSON.parse(fromBase64Url(hParam))
          mergedHeaders = { ...parsedH, ...mergedHeaders }
        } catch {}
      }

      const referer = parsed.searchParams.get('referer')
      const origin = parsed.searchParams.get('origin')
      if (referer && !mergedHeaders.Referer && !mergedHeaders.referer) mergedHeaders.Referer = referer
      if (origin && !mergedHeaders.Origin && !mergedHeaders.origin) mergedHeaders.Origin = origin

      if (extractedUrl) {
        return streamProxyUrl(extractedUrl, mergedHeaders)
      }
    } catch {}
  }

  if (!isAbsoluteHttpUrl(rawUrl)) return rawUrl

  const params = new URLSearchParams()
  params.set('url', rawUrl)

  const referer = headers?.Referer || headers?.referer
  const origin = headers?.Origin || headers?.origin
  if (referer) params.set('referer', referer)
  if (origin) params.set('origin', origin)

  const extraHeaders: Record<string, string> = {}
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      const lk = k.toLowerCase()
      if (lk !== 'referer' && lk !== 'origin' && lk !== 'user-agent' && typeof v === 'string' && v) {
        extraHeaders[k] = v
      }
    }
  }
  if (Object.keys(extraHeaders).length > 0) {
    params.set('h', toBase64Url(JSON.stringify(extraHeaders)))
  }

  return `/api/stream/proxy?${params.toString()}`
}

export const vercelProxyUrl = streamProxyUrl
export const vpsProxyUrl = streamProxyUrl
