import { apiGet } from './client.js';

/**
 * 获取当前热门视频列表
 * GET https://api.bilibili.com/x/web-interface/popular
 */
async function getPopular(pn = 1, ps = 20) {
  const data = await apiGet('https://api.bilibili.com/x/web-interface/popular', { pn, ps });

  if (data.code !== 0) {
    throw new Error(`Popular API error: ${data.code} - ${data.message}`);
  }

  const list = data.data?.list || [];

  const videos = list.map((item) => ({
    bvid: item.bvid,
    aid: item.aid,
    title: item.title,
    cover: item.pic,
    duration: item.duration,
    author: item.owner?.name || '',
    mid: item.owner?.mid || 0,
    authorFace: item.owner?.face || '',
    play: item.stat?.view || 0,
    videoReview: item.stat?.danmaku || 0,
    favorites: item.stat?.favorite || 0,
    description: item.desc || '',
    pubdate: item.pubdate,
    cid: item.cid || null,
  }));

  return {
    videos,
    hasMore: data.data?.no_more !== true,
  };
}

export { getPopular };
