/**
 * 音频 URL 缓存 — 使用 LRU 淘汰并在签名 URL 过期前主动失效
 */

const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_TTL = 10 * 60 * 1000;

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

  return { get, set, getInfo, clear };
}
