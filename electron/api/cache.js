// ── Unified LRU Response Cache ──
// 缓存所有 GET 请求的成功响应（code === 0），包括搜索、歌单、歌词等
// 歌词字幕（B站 subtitle JSON）也通过 cachedFetch 纳入此缓存
// 独立模块，不依赖 client.js，避免循环引用

let RESPONSE_CACHE_MAX = 500
const RESPONSE_CACHE_TTL = 20 * 60 * 1000 // 20 minutes
const responseCache = new Map()

// URLs that should NOT be cached
const NO_CACHE_PATTERNS = [
  '/x/passport-login/web/qrcode/',
  '/x/web-interface/nav', // WBI keys endpoint
]

function shouldCache(url) {
  return !NO_CACHE_PATTERNS.some(p => url.includes(p))
}

function getCacheKey(url, params) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params || {})) {
    searchParams.append(key, String(value))
  }
  const queryString = searchParams.toString()
  return queryString ? `${url}?${queryString}` : url
}

function responseCacheGet(key) {
  if (!responseCache.has(key)) return undefined
  const entry = responseCache.get(key)
  if (Date.now() > entry.expires) {
    responseCache.delete(key)
    return undefined
  }
  // LRU: move to end
  responseCache.delete(key)
  responseCache.set(key, entry)
  return entry.data
}

function responseCacheSet(key, data) {
  if (responseCache.has(key)) responseCache.delete(key)
  else if (responseCache.size >= RESPONSE_CACHE_MAX) {
    const oldest = responseCache.keys().next().value
    responseCache.delete(oldest)
  }
  responseCache.set(key, { data, expires: Date.now() + RESPONSE_CACHE_TTL })
}

function getResponseCacheStats() {
  // Remove expired entries first
  const now = Date.now()
  for (const [key, entry] of responseCache) {
    if (now > entry.expires) responseCache.delete(key)
  }
  return {
    size: responseCache.size,
    max: RESPONSE_CACHE_MAX
  }
}

function clearResponseCache() {
  responseCache.clear()
}

/** 清除指定收藏夹的所有分页缓存（addFav/removeFav 后调用） */
function invalidateFavCache(mediaId) {
  const prefix = `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${mediaId}&`
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) responseCache.delete(key)
  }
}

function setResponseCacheMax(max) {
  RESPONSE_CACHE_MAX = Math.max(50, Math.min(5000, max))
  // Trim if over new limit
  while (responseCache.size > RESPONSE_CACHE_MAX) {
    const oldest = responseCache.keys().next().value
    responseCache.delete(oldest)
  }
}

export {
  shouldCache,
  getCacheKey,
  responseCacheGet,
  responseCacheSet,
  getResponseCacheStats,
  clearResponseCache,
  invalidateFavCache,
  setResponseCacheMax
}
