import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, mkdirSync, readdirSync } from 'fs'
import { sign } from './sign'
import { apiGet } from './client'
import { parseLRC } from './lrc'
import { searchCandidates, fetchLyric } from './lyricSources'

function getLyricsDir() {
  const dir = join(app.getPath('userData'), 'lyrics')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function findLocalLyric(title, bvid) {
  if (!title && !bvid) return null
  const dir = getLyricsDir()
  const files = readdirSync(dir).filter(f => f.endsWith('.lrc'))
  const keyword = title?.toLowerCase() || ''

  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), 'utf-8')
      const lines = content.split('\n')

      // 优先匹配 bvid
      if (bvid) {
        const bvidLine = lines.find(l => l.startsWith('[bvid:'))
        const fileBvid = bvidLine ? bvidLine.replace('[bvid:', '').replace(']', '').trim() : ''
        if (fileBvid && fileBvid === bvid) {
          const lyrics = parseLRC(content)
          if (lyrics.length > 0) return lyrics
        }
      }

      // 匹配歌曲名
      if (title) {
        const tiLine = lines.find(l => l.startsWith('[ti:'))
        const songTitle = tiLine ? tiLine.replace('[ti:', '').replace(']', '').trim() : file.replace('.lrc', '')
        if (songTitle.toLowerCase().includes(keyword) || keyword.includes(songTitle.toLowerCase())) {
          const lyrics = parseLRC(content)
          if (lyrics.length > 0) return lyrics
        }
      }
    } catch {}
  }
  return null
}

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
    const resp = await fetch(subtitle.subtitle_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com'
      }
    })
    const subData = await resp.json()
    return (subData.body || []).map((item) => ({
      time: item.from,
      text: item.content
    }))
  } catch {
    return null
  }
}

async function getLyric(bvid, cid, title) {
  // 优先匹配本地 LRC 文件
  if (title || bvid) {
    const localLyrics = findLocalLyric(title, bvid)
    if (localLyrics) return { source: 'local', lyrics: localLyrics }
  }

  const subtitleLyrics = await getBilibiliSubtitle(bvid, cid)
  if (subtitleLyrics && subtitleLyrics.length > 0) {
    return { source: 'subtitle', lyrics: subtitleLyrics }
  }

  if (title) {
    const candidates = await searchCandidates(title)
    for (const c of candidates) {
      const result = await fetchLyric(c.source, c.id)
      if (result) return result
    }
  }

  return { source: 'none', lyrics: [] }
}

export { getLyric, parseLRC, searchCandidates, fetchLyric }
