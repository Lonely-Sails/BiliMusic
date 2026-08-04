import { sign } from './sign.js';
import { apiGet } from './client.js';

/**
 * 获取用户空间详细信息
 * GET https://api.bilibili.com/x/space/wbi/acc/info
 */
async function getUserInfo(mid) {
  const params = await sign({ mid });
  const data = await apiGet('https://api.bilibili.com/x/space/wbi/acc/info', params);

  if (data.code !== 0) {
    throw new Error(`User info API error: ${data.code} - ${data.message}`);
  }

  const d = data.data || {};
  return {
    mid: d.mid,
    name: d.name,
    face: d.face ? (d.face.startsWith('//') ? 'https:' + d.face : d.face) : '',
    sign: d.sign || '',
    level: d.level || 0,
    official: d.official || null,
    vip: d.vip || null,
    topPhoto: d.top_photo || '',
    isFollowed: !!d.is_followed,
  };
}

/**
 * 查询用户关系状态数（关注数 / 粉丝数）
 * GET https://api.bilibili.com/x/relation/stat
 */
async function getUserRelationStat(mid) {
  const data = await apiGet('https://api.bilibili.com/x/relation/stat', { vmid: mid });

  if (data.code !== 0) {
    throw new Error(`User relation stat API error: ${data.code} - ${data.message}`);
  }

  const d = data.data || {};
  return {
    mid: d.mid,
    following: d.following || 0,
    follower: d.follower || 0,
  };
}

/**
 * 获取用户投稿视频列表
 * GET https://api.bilibili.com/x/space/wbi/arc/search
 * @param {number} mid 用户 mid
 * @param {number} [pageNum=1] 页码
 * @param {number} [pageSize=30] 每页数量
 * @param {string} [keyword=''] 关键词筛选
 */
async function getUserArchives(mid, pageNum = 1, pageSize = 30, keyword = '') {
  const params = await sign({ mid, ps: pageSize, pn: pageNum, order: 'pubdate', keyword });
  const data = await apiGet('https://api.bilibili.com/x/space/wbi/arc/search', params);

  if (data.code !== 0) {
    throw new Error(`User archives API error: ${data.code} - ${data.message}`);
  }

  const d = data.data || {};
  const list = d.list || {};
  const vlist = list.vlist || [];

  const archives = vlist.map((item) => ({
    bvid: item.bvid,
    aid: item.aid,
    title: item.title,
    cover: item.pic ? (item.pic.startsWith('//') ? 'https:' + item.pic : item.pic) : '',
    duration: parseDuration(item.duration || item.length),
    play: item.play || 0,
    videoReview: item.video_review || 0,
    author: item.author || '',
    mid: item.mid || mid,
    description: item.description || '',
    pubdate: item.created || item.ctime || 0,
    cid: null,
  }));

  const page = d.page || {};
  return {
    archives,
    count: page.count || 0,
    pageNum: page.pn || pageNum,
    pageSize: page.ps || pageSize,
  };
}

/** 将 "mm:ss" 或 "h:mm:ss" 格式的时长字符串转换为秒 */
function parseDuration(duration) {
  if (!duration) return 0;
  if (typeof duration === 'number') return duration;
  const parts = String(duration)
    .split(':')
    .map((n) => parseInt(n, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export { getUserInfo, getUserRelationStat, getUserArchives };
