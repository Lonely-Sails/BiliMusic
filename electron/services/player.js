/**
 * 播放器服务 — 编排视频信息与音频流地址获取
 *
 * 音频流由渲染进程 <audio> 直接加载 CDN 地址，
 * Referer/CORS 请求头由 windows.js 的 webRequest 拦截注入。
 */

import { getVideoInfo, getAudioUrl } from '../api/video.js';

async function resolveVideoInfo(bvid, aid) {
  if (!bvid && !aid) throw new Error('bvid or aid required');
  return getVideoInfo(bvid, aid);
}

async function resolveAudioUrl(bvid, cid) {
  if (!bvid || !cid) throw new Error('bvid and cid required');
  return getAudioUrl(bvid, cid);
}

export { resolveVideoInfo, resolveAudioUrl };
