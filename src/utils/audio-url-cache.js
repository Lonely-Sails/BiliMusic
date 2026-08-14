/**
 * 音频 URL 缓存 — 使用 LRU 淘汰并在签名 URL 过期前主动失效
 */

const DEFAULT_MAX_ENTRIES = 200;
// B站 playurl 有效期可能随服务端调整，缓存保守取 5 分钟，
// 超时后重新解析，避免拿到已失效的签名 URL 导致播放失败
const DEFAULT_TTL = 5 * 60 * 1000;

export function createAudioUrlCache({ maxEntries = DEFAULT_MAX_ENTRIES, ttl = DEFAULT_TTL } = {}) {
  const entries = new Map();

  function get(key) {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      entries.delete(key);
      return undefined;
    }

    entries.delete(key);
    entries.set(key, entry);
    return entry.data;
  }

  function set(key, data) {
    if (entries.has(key)) {
      entries.delete(key);
    } else if (entries.size >= maxEntries) {
      entries.delete(entries.keys().next().value);
    }
    entries.set(key, { data, expires: Date.now() + ttl });
  }

  function getInfo() {
    return { size: entries.size, max: maxEntries };
  }

  function clear() {
    entries.clear();
  }

  /** 失效单个条目（播放失败重试时强制重新解析） */
  function invalidate(key) {
    entries.delete(key);
  }

  return { get, set, getInfo, clear, invalidate };
}
