import { parseLRC } from './lrc'

const BASE_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function publicGet(url, params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) qs.append(k, String(v))
  const fullUrl = qs.toString() ? `${url}?${qs}` : url
  const resp = await fetch(fullUrl, {
    headers: { 'User-Agent': BASE_UA }
  })
  return resp.json()
}

const SOURCES = [
  {
    key: 'qqmusic',
    name: 'QQ音乐',
    search: (keyword) => publicGet('https://api.vkeys.cn/v2/music/tencent/search/song', { word: keyword, page: 1, num: 8 }),
    lyric: (id) => publicGet('https://api.vkeys.cn/v2/music/tencent/lyric', { mid: id }),
    extractItems: (data) => (Array.isArray(data.data) ? data.data : []),
    extractId: (item) => item.mid,
    extractLyric: (data) => data.data?.lrc,
    extractTrans: (data) => data.data?.trans || null,
  },
  {
    key: 'netease',
    name: '网易云音乐',
    search: (keyword) => publicGet('https://api.vkeys.cn/v2/music/netease', { word: keyword, page: 1, num: 8 }),
    lyric: (id) => publicGet('https://api.vkeys.cn/v2/music/netease/lyric', { id }),
    extractItems: (data) => {
      if (Array.isArray(data.data)) return data.data
      if (data.data) return [data.data]
      return []
    },
    extractId: (item) => item.id,
    extractLyric: (data) => data.data?.lrc,
    extractTrans: () => null,
  },
]

async function searchCandidates(title, artist) {
  const keyword = [title, artist].filter(Boolean).join(' ')
  if (!keyword) return []

  const results = []
  for (const src of SOURCES) {
    try {
      const data = await src.search(keyword)
      if (data.code !== 200) continue
      for (const item of src.extractItems(data)) {
        results.push({
          source: src.key,
          sourceName: src.name,
          id: src.extractId(item),
          song: item.song || item.title,
          singer: item.singer,
          cover: item.cover,
        })
      }
    } catch (e) {
      console.error(`${src.name} search failed:`, e)
    }
  }

  return results
}

async function fetchLyric(sourceKey, id) {
  const src = SOURCES.find((s) => s.key === sourceKey)
  if (!src || !id) return null

  try {
    const data = await src.lyric(id)
    if (data.code !== 200) return null
    const lrc = src.extractLyric(data)
    if (!lrc) return null
    const lyrics = parseLRC(lrc)
    if (lyrics.length === 0) return null

    const result = { source: sourceKey, lyrics }
    const trans = src.extractTrans(data)
    if (trans) result.trans = parseLRC(trans)

    return result
  } catch (e) {
    console.error(`${src.name} lyric fetch failed:`, e)
    return null
  }
}

export { searchCandidates, fetchLyric }
