import { sign } from './sign'
import { apiGet, cachedFetch } from './client'
import { parseLRC, mergeTranslations, cleanLyrics } from './lrc'
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
 * 标准化文本：去空格、去标点、去 emoji、转小写，用于相似度比较
 * 处理 AI 字幕与歌词之间断字/标点/emoji 差异
 */
function normalizeText(text) {
  return text
    .replace(/\s+/g, '')                                           // 去空格（AI 断字差异）
    .replace(/[，。！？、；：""''（）【】《》「」『』～~…\-.·,:!?;'\"()\[\]{}<>]/g, '')  // 去标点
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // 去 emoji
    .toLowerCase()
}

/**
 * 计算两个文本的字符级相似度 (0~1)，已处理标点/空格/emoji 差异
 */
function textSimilarity(a, b) {
  if (!a || !b) return 0
  const s1 = normalizeText(a)
  const s2 = normalizeText(b)
  if (!s1 || !s2) return 0
  if (s1 === s2) return 1
  // 包含关系
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)
  }
  // 最长公共子串 / 较长字符串长度
  let maxLen = 0
  const short = s1.length <= s2.length ? s1 : s2
  const long = s1.length > s2.length ? s1 : s2
  for (let i = 0; i < short.length; i++) {
    for (let j = i + maxLen + 1; j <= short.length; j++) {
      if (long.includes(short.slice(i, j))) {
        maxLen = j - i
      }
    }
  }
  return maxLen / long.length
}

/**
 * 在字幕数组中搜索与目标文本最匹配的行（含合并连续行）
 * 处理 AI 将一句歌词拆成多条字幕的情况（如 "染红的山坡"+"告别的路口"）
 *
 * @param {string} targetText - 要匹配的歌词文本
 * @param {Array<{time:number,text:string}>} subtitles - AI 字幕数组
 * @param {number} [startIdx=0] - 开始搜索位置
 * @param {number} [searchEnd] - 搜索结束位置（不含），默认到末尾
 * @param {number} [threshold=0.3] - 最低相似度阈值
 * @param {number} [maxMerge=3] - 最多合并连续行数
 * @returns {{index:number, endIndex:number, similarity:number, subtitle:object}|null}
 */
function findBestSubtitleMatch(targetText, subtitles, startIdx = 0, searchEnd, threshold = 0.3, maxMerge = 3) {
  if (!targetText || !subtitles?.length) return null
  if (searchEnd === undefined) searchEnd = subtitles.length

  let best = { index: -1, endIndex: -1, similarity: 0, subtitle: null }

  for (let i = startIdx; i < searchEnd; i++) {
    // 单条字幕
    const sim = textSimilarity(targetText, subtitles[i].text)
    if (sim > best.similarity) {
      best = { index: i, endIndex: i, similarity: sim, subtitle: subtitles[i] }
    }

    // 合并连续行（处理 AI 断句）
    let merged = subtitles[i].text
    for (let k = 1; k < maxMerge && i + k < searchEnd; k++) {
      merged += subtitles[i + k].text
      const mergedSim = textSimilarity(targetText, merged)
      if (mergedSim > best.similarity) {
        best = { index: i, endIndex: i + k, similarity: mergedSim, subtitle: subtitles[i] }
      }
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

  // 先过滤制作信息行（作词/作曲/编曲等），避免干扰校对
  const cleaned = cleanLyrics(lyrics)
  if (!cleaned.length) return null

  const firstLine = cleaned[0]
  // 在整个字幕中搜索第一句（含合并断句），取首次匹配的组
  const match = findBestSubtitleMatch(firstLine.text, subtitles, 0, subtitles.length, 0.3, 3)
  if (!match) return null

  const offset = match.subtitle.time - firstLine.time
  const aligned = cleaned.map(l => ({
    ...l,
    time: Math.max(0, +(l.time + offset).toFixed(3))
  }))

  return { lyrics: aligned, offset, matchedIndex: match.index, endIndex: match.endIndex }
}

/**
 * 全自动校对：将 AI 字幕与歌词逐行匹配，为每行歌词找到最合适的字幕时间
 * 支持合并连续字幕行（处理 AI 断句差异，如 "染红的山坡"+"告别的路口"）
 * @param {Array<{time:number,text:string,trans?:string}>} lyrics
 * @param {Array<{time:number,text:string}>} subtitles
 * @param {number} [simThreshold=0.25] - 相似度阈值
 * @returns {{lyrics: Array, matched: number}}
 */
function autoAlignAll(lyrics, subtitles) {
  if (!lyrics?.length || !subtitles?.length) {
    return { lyrics: lyrics || [], matched: 0 }
  }

  // 先过滤制作信息行（作词/作曲/编曲等），避免干扰校对
  const cleaned = cleanLyrics(lyrics)
  if (!cleaned.length) return { lyrics: [], matched: 0 }

  let matched = 0
  let lastSubIdx = -1

  const result = cleaned.map((l) => {
    // 搜索范围：从上次匹配位置开始（含自身，处理AI合并多句到一条字幕的情况），最多搜索字幕长度的 1/3 作为窗口
    const searchStart = Math.max(0, lastSubIdx)
    const searchEnd = Math.min(subtitles.length, searchStart + Math.ceil(subtitles.length / 3))

    // 先在窗口内搜索（含合并断句）
    let match = findBestSubtitleMatch(l.text, subtitles, searchStart, searchEnd, 0.2, 3)

    // 窗口内没找到，扩大全局搜索
    if (!match) {
      match = findBestSubtitleMatch(l.text, subtitles, 0, subtitles.length, 0.2, 3)
    }

    if (match) {
      matched++
      lastSubIdx = match.endIndex
      return { ...l, time: match.subtitle.time }
    }
    return { ...l }
  })

  return { lyrics: result, matched }
}

export {
  parseLRC,
  mergeTranslations,
  cleanLyrics,
  searchCandidates,
  fetchLyric,
  getBilibiliSubtitle,
  getOnlineLyric,
  searchRankedCandidates,
  alignFirstLine,
  autoAlignAll,
  textSimilarity
}
