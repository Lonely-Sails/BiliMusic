/**
 * 播放器服务 — 编排视频信息、音频流地址与音频缓冲获取
 */

import { net } from 'electron';
import { getVideoInfo, getAudioUrl } from '../api/video.js';

const AUDIO_REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com',
};

async function resolveVideoInfo(bvid, aid) {
  if (!bvid && !aid) throw new Error('bvid or aid required');
  return getVideoInfo(bvid, aid);
}

async function resolveAudioUrl(bvid, cid) {
  if (!bvid || !cid) throw new Error('bvid and cid required');
  return getAudioUrl(bvid, cid);
}

async function fetchAudioBuffer(url) {
  if (!url || typeof url !== 'string') throw new Error('audio url required');

  const response = await net.fetch(url, { headers: AUDIO_REQUEST_HEADERS });
  if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);

  return Buffer.from(await response.arrayBuffer());
}

export { resolveVideoInfo, resolveAudioUrl, fetchAudioBuffer };
