import { createHash } from 'crypto';
import { apiGet } from './client.js';

// WBI signing key mixin table (from Bilibili API docs)
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28,
  14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54,
  21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

let wbiKeys = null;
let wbiKeysExpire = 0;

function getMixinKey(imgKey, subKey) {
  const combined = imgKey + subKey;
  let result = '';
  for (const i of MIXIN_KEY_ENC_TAB) {
    result += combined[i] || '';
  }
  return result.slice(0, 32);
}

async function fetchWbiKeys() {
  const now = Date.now();
  if (wbiKeys && now < wbiKeysExpire) {
    return wbiKeys;
  }

  const data = await apiGet('https://api.bilibili.com/x/web-interface/nav');

  if (data.code !== 0 || !data.data) {
    throw new Error('Failed to fetch WBI keys');
  }

  const imgUrl = data.data.wbi_img?.img_url || '';
  const subUrl = data.data.wbi_img?.sub_url || '';

  // Extract keys from URLs: filename before the extension
  const imgKey = imgUrl.split('/').pop()?.split('.')[0] || '';
  const subKey = subUrl.split('/').pop()?.split('.')[0] || '';

  if (!imgKey || !subKey) {
    throw new Error('Failed to extract WBI keys from nav response');
  }

  wbiKeys = { imgKey, subKey, mixinKey: getMixinKey(imgKey, subKey) };
  wbiKeysExpire = now + 24 * 60 * 60 * 1000; // Cache for 24 hours
  return wbiKeys;
}

async function sign(params = {}) {
  const { mixinKey } = await fetchWbiKeys();

  const signed = { ...params };
  signed.wts = Math.floor(Date.now() / 1000);

  // Sort keys alphabetically
  const keys = Object.keys(signed).sort();
  const sortedParams = {};
  for (const key of keys) {
    sortedParams[key] = signed[key];
  }

  // Build query string
  const query = keys
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(signed[key]))}`)
    .join('&');

  // Compute w_rid
  const signStr = query + mixinKey;
  signed.w_rid = createHash('md5').update(signStr).digest('hex');

  return signed;
}

export { sign, fetchWbiKeys };
