import { sign } from './sign'
import { apiGet, cachedFetch } from './client'
import { parseLRC, mergeTranslations } from './lrc'
import { searchCandidates, fetchLyric, rankCandidates } from './lyricSources'

/**
 * 获取 B 站 AI 字幕（不依赖本地存储）
 */
async function getBilibiliSubtitle(bvid, cid) {
  const params = await sign({ bvid, cid })
  const data = await apiGet('https://api.bilibili.com/x/player/v2', params)

  if (data.code !== 0) return null

  const playerData = data.data
  if (!playerData?.subtitle?.subtitles?.length) return null

  let subtitle = playerData.subtitle.subtitles.find(
    (s) => s.lang_key === 'zh-Hans' || s.lang_key === 'zh-CN' || s.lang_key === 'zh-CHS'
  )
  if (!subtitle) subtitle = playerData.subtitle.subtitles[0]
  if (!subtitle?.subtitle_url) return null
  try {
    const subData = await cachedFetch(subtitle.subtitle_url)
    return (subData.body || []).map((item) => ({
      time: item.from,
      text: item.content
    }))
  } catch {
    return null
  }
}

/**
 * 纯 API：根据标题在线搜索歌词，返回最优结果
 */
async function getOnlineLyric(title) {
  if (!title) return null
  const candidates = await searchCandidates(title)
  for (const c of candidates) {
    const result = await fetchLyric(c.source, c.id)
    if (result) {
      if (result.trans && result.trans.length > 0) {
        result.lyrics = mergeTranslations(result.lyrics, result.trans)
      }
      return result
    }
  }
  return null
}

/**
 * 搜索歌词候选并按照与视频标题+作者的相似度排序
 * @param {string} title - 搜索关键词
 * @param {string} videoTitle - 视频标题（用于相似度排序）
 * @param {string} [author] - 视频作者/UP主名
 * @returns {Promise<Array>} 排序后的候选列表，每项附带相似度分数
 */
async function searchRankedCandidates(title, videoTitle, author) {
  const candidates = await searchCandidates(title)
  return rankCandidates(candidates, videoTitle || title, author)
}

// ── AI 字幕与歌词校对 ──

/**
 * 计算两个文本的字符级相似度 (0~1)
 */
function textSimilarity(a, b) {
  if (!a || !b) return 0
  const s1 = a.replace(/\s+/g, '').toLowerCase()
  const s2 = b.replace(/\s+/g, '').toLowerCase()
  if (!s1 || !s2) return 0
  if (s1 === s2) return 1
  // 最长公共子串 / 较短字符串长度
  let maxLen = 0
  for (let i = 0; i < s1.length; i++) {
    for (let j = i + 1; j <= s1.length; j++) {
      const sub = s1.slice(i, j)
      if (s2.includes(sub) && sub.length > maxLen) {
        maxLen = sub.length
      }
    }
  }
  return maxLen / Math.max(s1.length, s2.length)
}

/**
 * 找到与目标文本最相似的字幕行下标
 * @param {string} targetText - 要匹配的歌词文本
 * @param {Array<{time:number,text:string}>} subtitles - AI 字幕数组
 * @param {number} [threshold=0.3] - 最低相似度阈值
 * @returns {{index:number, similarity:number, subtitle:object}|null}
 */
function findBestSubtitleMatch(targetText, subtitles, threshold = 0.3) {
  if (!targetText || !subtitles?.length) return null
  let best = { index: -1, similarity: 0, subtitle: null }
  for (let i = 0; i < subtitles.length; i++) {
    const sim = textSimilarity(targetText, subtitles[i].text)
    if (sim > best.similarity) {
      best = { index: i, similarity: sim, subtitle: subtitles[i] }
    }
  }
  return best.similarity >= threshold ? best : null
}

/**
 * 默认校对：只用歌词第一句匹配 AI 字幕第一句相似的行，
 * 计算出时间偏移后应用到所有歌词行
 * @param {Array<{time:number,text:string,trans?:string}>} lyrics
 * @param {Array<{time:number,text:string}>} subtitles
 * @returns {{lyrics: Array, offset: number, matchedIndex: number}|null}
 */
function alignFirstLine(lyrics, subtitles) {
  if (!lyrics?.length || !subtitles?.length) return null

  const firstLine = lyrics[0]
  const match = findBestSubtitleMatch(firstLine.text, subtitles)
  if (!match) return null

  const offset = match.subtitle.time - firstLine.time
  const aligned = lyrics.map(l => ({
    ...l,
    time: Math.max(0, +(l.time + offset).toFixed(3))
  }))

  return { lyrics: aligned, offset, matchedIndex: match.index }
}

/**
 * 全自动校对：将 AI 字幕与歌词逐行匹配，为每行歌词找到最合适的字幕时间
 * @param {Array<{time:number,text:string,trans?:string}>} lyrics
 * @param {Array<{time:number,text:string}>} subtitles
 * @param {number} [simThreshold=0.25] - 相似度阈值
 * @returns {{lyrics: Array, matched: number}}
 */
function autoAlignAll(lyrics, subtitles) {
  if (!lyrics?.length || !subtitles?.length) {
    return { lyrics: lyrics || [], matched: 0 }
  }

  let matched = 0
  let lastSubIdx = -1

  const result = lyrics.map((l, idx) => {
    // 找到当前行最相似的字幕行（从上次匹配的位置之后开始搜索）
    let bestSim = 0
    let bestSub = null

    // 搜索范围：从 lastSubIdx+1 开始，最多搜索字幕长度的 1/3 作为窗口
    const searchStart = Math.max(0, lastSubIdx + 1)
    const searchEnd = Math.min(subtitles.length, searchStart + Math.ceil(subtitles.length / 3))

    for (let i = searchStart; i < searchEnd; i++) {
      const sim = textSimilarity(l.text, subtitles[i].text)
      if (sim > bestSim) {
        bestSim = sim
        bestSub = subtitles[i]
      }
    }

    // 如果当前窗口没找到，扩大搜索范围
    if (!bestSub || bestSim < 0.2) {
      for (let i = 0; i < subtitles.length; i++) {
        const sim = textSimilarity(l.text, subtitles[i].text)
        if (sim > bestSim) {
          bestSim = sim
          bestSub = subtitles[i]
        }
      }
    }

    if (bestSub && bestSim >= 0.2) {
      matched++
      lastSubIdx = subtitles.indexOf(bestSub)
      return { ...l, time: bestSub.time }
    }
    return { ...l }
  })

  return { lyrics: result, matched }
}

export {
  parseLRC,
  mergeTranslations,
  searchCandidates,
  fetchLyric,
  getBilibiliSubtitle,
  getOnlineLyric,
  searchRankedCandidates,
  alignFirstLine,
  autoAlignAll,
  textSimilarity
}
