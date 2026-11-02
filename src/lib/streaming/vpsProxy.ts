export const VPS_ORIGIN = 'https://hahaevilcraft.site'

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function convertRelativeProxyUrl(
  rawUrl: string,
  headers?: Record<string, string>,
): string | null {
  if (!rawUrl.startsWith('/proxy?') && !rawUrl.startsWith('/api/stream/proxy?')) {
    return null
  }

  const parsed = new URL(rawUrl, VPS_ORIGIN)
  const target = parsed.searchParams.get('url')
  if (!target) return `${VPS_ORIGIN}${rawUrl}`

  const merged: Record<string, string> = { ...(headers || {}) }
  const referer = parsed.searchParams.get('referer')
  const origin = parsed.searchParams.get('origin')
  if (referer && !merged.Referer && !merged.referer) merged.Referer = referer
  if (origin && !merged.Origin && !merged.origin) merged.Origin = origin

  return vpsProxyUrl(target, merged)
}

export function vpsProxyUrl(
  rawUrl: string,
  headers?: Record<string, string>,
): string {
  if (!rawUrl) return rawUrl

  if (rawUrl.startsWith(`${VPS_ORIGIN}/proxy?`)) return rawUrl
  if (rawUrl.startsWith(`${VPS_ORIGIN}/api/stream/proxy?`)) {
    return convertRelativeProxyUrl(rawUrl.slice(VPS_ORIGIN.length), headers) || rawUrl
  }

  const relative = convertRelativeProxyUrl(rawUrl, headers)
  if (relative) return relative

  if (!isAbsoluteHttpUrl(rawUrl)) return rawUrl

  const u = toBase64Url(rawUrl)
  const headerEntries = headers
    ? Object.entries(headers).filter(([, value]) => typeof value === 'string' && value)
    : []
  if (!headerEntries.length) return `${VPS_ORIGIN}/proxy?u=${u}`

  const h = toBase64Url(JSON.stringify(Object.fromEntries(headerEntries)))
  return `${VPS_ORIGIN}/proxy?u=${u}&h=${h}`
}
