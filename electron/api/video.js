import { sign } from './sign'
import { apiGet } from './client'

async function getVideoInfo(bvid, aid) {
  const params = await sign(bvid ? { bvid } : { aid })
  const data = await apiGet('https://api.bilibili.com/x/web-interface/wbi/view', params)

  if (data.code !== 0) {
    throw new Error(`Video info API error: ${data.code} - ${data.message}`)
  }

  const v = data.data
  return {
    bvid: v.bvid,
    aid: v.aid,
    title: v.title,
    cover: v.pic,
    duration: v.duration,
    author: v.owner?.name,
    mid: v.owner?.mid,
    authorFace: v.owner?.face,
    description: v.desc,
    pages: (v.pages || []).map((p) => ({
      cid: p.cid,
      page: p.page,
      part: p.part,
      duration: p.duration
    })),
    stats: v.stat || {},
    pubdate: v.pubdate,
    cid: v.cid // First page CIDs
  }
}

async function getAudioUrl(bvid, cid) {
  const params = await sign({
    bvid,
    cid,
    fnval: 4048, // DASH format with all qualities
    fourk: 1,
    otype: 'json'
  })

  const data = await apiGet('https://api.bilibili.com/x/player/wbi/playurl', params)

  if (data.code !== 0) {
    throw new Error(`Playurl API error: ${data.code} - ${data.message}`)
  }

  const playData = data.data

  // Prefer DASH audio
  if (playData.dash && playData.dash.audio && playData.dash.audio.length > 0) {
    const audios = playData.dash.audio
    // Best quality first (usually 30280 = 192K, 30232 = 132K, 30216 = 64K)
    const sorted = audios.sort((a, b) => b.bandwidth - a.bandwidth)
    const best = sorted[0]
    return {
      url: best.baseUrl || best.base_url,
      backupUrls: best.backupUrl || best.backup_url || [],
      bandwidth: best.bandwidth,
      mimeType: best.mimeType,
      codecs: best.codecs,
      id: best.id,
      type: 'dash'
    }
  }

  // Fallback to DURL (MP4 format)
  if (playData.durl && playData.durl.length > 0) {
    return {
      url: playData.durl[0].url,
      backupUrls: playData.durl[0].backup_url || [],
      type: 'durl'
    }
  }

  throw new Error('No audio stream found in video')
}

export { getVideoInfo, getAudioUrl }
