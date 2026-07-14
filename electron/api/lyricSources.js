import { parseLRC } from './lrc'
import { cachedFetch } from './client'

const BASE_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function publicGet(url, params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) qs.append(k, String(v))
  const fullUrl = qs.toString() ? `${url}?${qs}` : url

  return await cachedFetch(fullUrl, {
    headers: { 'User-Agent': BASE_UA }
  })
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
    extractTrans: (data) => data.data?.tlyric?.lyric || null,
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

/**
 * 计算两个文本的相似度 (0~1)，用于歌曲名/歌手名匹配
 * 考虑包含关系、公共子串长度
 */
function textSimilarity(a, b) {
  if (!a || !b) return 0
  const s1 = a.replace(/\s+/g, '').toLowerCase()
  const s2 = b.replace(/\s+/g, '').toLowerCase()
  if (!s1 || !s2) return 0
  if (s1 === s2) return 1
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)
  }
  // 最长公共子串
  let maxLen = 0
  const short = s1.length <= s2.length ? s1 : s2
  const long = s1.length > s2.length ? s1 : s2
  for (let i = 0; i < short.length; i++) {
    for (let j = i + 1; j <= short.length; j++) {
      if (long.includes(short.slice(i, j))) {
        maxLen = Math.max(maxLen, j - i)
      }
    }
  }
  return maxLen / long.length
}

/**
 * 从视频标题中提取关键词（去除常见无意义词汇）
 */
function extractKeywords(title) {
  if (!title) return []
  // 去除标点、括号内容等
  const cleaned = title
    .replace(/[《》【】「」""''（）()\-—·,./:：;；！!?？]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.split(' ').filter(w => w.length >= 2)
}

/**
 * 去除标点、空格，取小写用于子串匹配
 */
function normalize(str) {
  return str.replace(/[^\w\u4e00-\u9fff]/g, '').toLowerCase()
}

/**
 * 为歌词搜索候选按与视频标题+作者的匹配度排序
 *
 * 策略：
 * 1. 歌名和歌手名都出现在「标题+作者」中 → 直接给高分 (0.9)
 * 2. 否则用相似度兜底
 *
 * @param {Array} candidates - searchCandidates 的结果
 * @param {string} videoTitle - 视频标题
 * @param {string} [author] - 视频作者/UP主名
 * @returns {Array} 排序后的候选（带 score 字段）
 */
function rankCandidates(candidates, videoTitle, author) {
  if (!candidates?.length) return []
  const compareText = normalize([videoTitle, author].filter(Boolean).join(' '))

  return candidates.map(c => {
    const songName = normalize(c.song || '')
    const singer = normalize(c.singer || '')
    let score = 0

    // 歌名和歌手都出现在对比文本中 → 完美匹配
    console.log('Rank candidate:', c.song, c.singer, 'vs', compareText)
    const songInText = songName && compareText.includes(songName)
    const singerInText = singer && compareText.includes(singer)
    if (songInText && singerInText) score = 1
    else if (songInText) score = 0.7
    else if (singerInText) score = 0.5
    else {
      // 兜底：用相似度
      score += textSimilarity(songName, compareText) * 0.6
      score += textSimilarity(singer, compareText) * 0.25
    }

    return { ...c, score: Math.min(1, Math.round(score * 100) / 100) }
  }).sort((a, b) => b.score - a.score)
}

export { searchCandidates, fetchLyric, rankCandidates, textSimilarity, extractKeywords }
