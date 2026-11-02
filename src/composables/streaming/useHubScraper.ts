import { ref } from 'vue'

const HUB_BASE =
  typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://watchable-virid.vercel.app'

export interface HubStream {
  name: string
  title: string
  url: string
  proxyUrl: string
  quality: string
  type: string
  headers: Record<string, string>
  provider: string
  _providerName: string
  providerId?: string
  proxyMode?: 'inherit' | 'on' | 'off'
}

export interface HubSearchResult {
  provider: string
  providerName: string
  priority: number
  proxyMode?: 'inherit' | 'on' | 'off'
  count: number
  servers: string[]
  streams: HubStream[]
}

export interface HubSearchResponse {
  query: string
  type: string
  results: HubSearchResult[]
  errors: Array<{ provider: string; error: string }>
  totalStreams: number
}

export function useHubScraper() {
  const loading = ref(false)
  const error = ref('')
  const results = ref<HubSearchResult[]>([])
  const totalStreams = ref(0)

  async function search(tmdbId: string, type: string, season?: string, episode?: string) {
    loading.value = true
    error.value = ''
    results.value = []
    totalStreams.value = 0

    try {
      let url = `${HUB_BASE}/api/search?q=${encodeURIComponent(tmdbId)}&type=${type}&starred=1`
      if (season) url += `&season=${season}`
      if (episode) url += `&episode=${episode}`

      const res = await fetch(url)
      if (!res.ok) throw new Error(`Search failed (${res.status})`)

      const data: HubSearchResponse = await res.json()

      const normalizeProxyMode = (raw?: string | null): 'inherit' | 'on' | 'off' => {
        if (raw === '0' || raw === 'off') return 'off'
        if (raw === '1' || raw === 'vps' || raw === 'cf' || raw === 'on') return 'on'
        return 'inherit'
      }

      for (const group of data.results) {
        group.proxyMode = normalizeProxyMode(group.proxyMode)
        for (const stream of group.streams) {
          stream._providerName = group.providerName
          stream.providerId = group.provider
          stream.proxyMode = normalizeProxyMode(group.proxyMode)
          if (stream.proxyUrl && stream.proxyUrl.startsWith('/')) {
            stream.proxyUrl = HUB_BASE + stream.proxyUrl
          }
        }
      }

      results.value = data.results
      totalStreams.value = data.totalStreams
    } catch (e: any) {
      error.value = e.message || 'Search failed'
    } finally {
      loading.value = false
    }
  }

  return { loading, error, results, totalStreams, search }
}
