import { apiGet } from './client'

/**
 * 获取音乐中心 Banner + 导航
 * GET /x/centralization/interface/music/banner
 */
async function getMusicBanner() {
  const data = await apiGet('https://api.bilibili.com/x/centralization/interface/music/banner', {
    plat: 2,
    web_location: '333.1351'
  })
  if (data.code !== 0) {
    throw new Error(`Music banner API error: ${data.code}`)
  }
  return data.data
}

/**
 * 获取音乐热门TOP榜单（含排名变化、热度值）
 * GET /x/centralization/interface/music/hot/toplist
 */
async function getHotToplist() {
  const data = await apiGet('https://api.bilibili.com/x/centralization/interface/music/hot/toplist', {
    web_location: '333.1351'
  })
  if (data.code !== 0) {
    throw new Error(`Hot toplist API error: ${data.code}`)
  }
  return data.data
}

/**
 * 获取音乐热门榜（累计播放量排序，100首）
 * GET /x/centralization/interface/music/hot/rank
 */
async function getHotRank() {
  const data = await apiGet('https://api.bilibili.com/x/centralization/interface/music/hot/rank', {
    plat: 2,
    web_location: '333.1351'
  })
  if (data.code !== 0) {
    throw new Error(`Hot rank API error: ${data.code}`)
  }
  return data.data
}

/**
 * 获取新歌列表
 * GET /x/centralization/interface/new/music
 */
async function getNewMusic() {
  const data = await apiGet('https://api.bilibili.com/x/centralization/interface/new/music', {
    plat: 2,
    web_location: '333.1351'
  })
  if (data.code !== 0) {
    throw new Error(`New music API error: ${data.code}`)
  }
  return data.data
}

/**
 * 获取综合榜（分页）
 * GET /x/centralization/interface/music/comprehensive/web/rank
 */
async function getComprehensiveRank(pn = 1, ps = 20) {
  const data = await apiGet('https://api.bilibili.com/x/centralization/interface/music/comprehensive/web/rank', {
    pn,
    ps,
    web_location: '333.1351'
  })
  if (data.code !== 0) {
    throw new Error(`Comprehensive rank API error: ${data.code}`)
  }
  return data.data
}

export { getMusicBanner, getHotToplist, getHotRank, getNewMusic, getComprehensiveRank }
