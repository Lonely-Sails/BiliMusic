import { sign } from './sign.js';
import { apiGet } from './client.js';

async function getVideoInfo(bvid, aid) {
  const params = await sign(bvid ? { bvid } : { aid });
  const data = await apiGet('https://api.bilibili.com/x/web-interface/wbi/view', params);

  if (data.code !== 0) {
    throw new Error(`Video info API error: ${data.code} - ${data.message}`);
  }

  const v = data.data;
  return {
    bvid: v.bvid,
    aid: v.aid,
    title: v.title,
    duration: v.duration,
    author: v.owner?.name,
    mid: v.owner?.mid,
    authorFace: v.owner?.face,
    description: v.desc,
    cover: v.pic ? (v.pic.startsWith('//') ? 'https:' + v.pic : v.pic) : '',
    pages: (v.pages || []).map((p) => ({
      cid: p.cid,
      page: p.page,
      part: p.part,
      duration: p.duration,
    })),
    stats: v.stat || {},
    pubdate: v.pubdate,
    cid: v.cid, // First page CIDs
    // BGM 信息（用于歌词搜索）
    bgm_info: v.bgm_info || null,
    // 字幕信息（已禁用）
    // subtitle: v.subtitle || null
  };
}

async function getAudioUrl(bvid, cid) {
  const params = await sign({
    bvid,
    cid,
    fnval: 4048, // DASH format with all qualities
    fourk: 1,
    otype: 'json',
  });

  const data = await apiGet('https://api.bilibili.com/x/player/wbi/playurl', params);

  if (data.code !== 0) {
    throw new Error(`Playurl API error: ${data.code} - ${data.message}`);
  }

  const playData = data.data;

  // Prefer DASH audio
  if (playData.dash && playData.dash.audio && playData.dash.audio.length > 0) {
    const audios = playData.dash.audio;
    // Best quality first (usually 30280 = 192K, 30232 = 132K, 30216 = 64K)
    const sorted = audios.sort((a, b) => b.bandwidth - a.bandwidth);
    const best = sorted[0];
    return {
      url: best.baseUrl || best.base_url,
      backupUrls: best.backupUrl || best.backup_url || [],
      bandwidth: best.bandwidth,
      mimeType: best.mimeType,
      codecs: best.codecs,
      id: best.id,
      type: 'dash',
    };
  }

  // Fallback to DURL (MP4 format)
  if (playData.durl && playData.durl.length > 0) {
    return {
      url: playData.durl[0].url,
      backupUrls: playData.durl[0].backup_url || [],
      type: 'durl',
    };
  }

  throw new Error('No audio stream found in video');
}

/**
 * 获取视频合集信息
 * GET https://api.bilibili.com/x/polymer/web-space/seasons_archives_list
 */
async function getSeasonArchives(mid, seasonId, pageNum = 1, pageSize = 30) {
  const params = await sign({
    mid,
    season_id: seasonId,
    sort_reverse: false,
    page_num: pageNum,
    page_size: pageSize,
    web_location: '333.999',
  });

  const data = await apiGet(
    'https://api.bilibili.com/x/polymer/web-space/seasons_archives_list',
    params
  );

  if (data.code !== 0) throw new Error(`Season archives API error: ${data.code} - ${data.message}`);

  const d = data.data || {};
  const meta = d.meta || {};
  const archives = (d.archives || []).map((a) => ({
    bvid: a.bvid,
    aid: a.aid,
    title: a.title,
    cover: a.pic ? (a.pic.startsWith('//') ? 'https:' + a.pic : a.pic) : '',
    duration: a.duration,
    play: a.stat?.view || 0,
    author: '', // 合集内视频作者由 meta.mid 决定
  }));

  return {
    meta: {
      seasonId: meta.season_id,
      name: meta.name,
      cover: meta.cover ? (meta.cover.startsWith('//') ? 'https:' + meta.cover : meta.cover) : '',
      description: meta.description || '',
      mid: meta.mid,
      total: meta.total || 0,
    },
    archives,
    page: d.page || { page_num: pageNum, page_size: pageSize, total: 0 },
  };
}

/**
 * 批量检测视频是否有合集（返回 bvid → 合集信息 映射）
 * 通过 getVideoInfo 获取 ugc_season 信息
 */
async function checkVideoSeason(bvid) {
  const params = await sign({ bvid });
  const data = await apiGet('https://api.bilibili.com/x/web-interface/wbi/view', params);
  if (data.code !== 0) return null;
  const season = data.data?.ugc_season;
  if (!season) return null;
  return {
    seasonId: season.id,
    title: season.title,
    mid: season.mid,
    epCount: season.ep_count || 0,
  };
}

async function batchCheckVideoSeason(bvids = []) {
  const results = await Promise.allSettled(bvids.map((bvid) => checkVideoSeason(bvid)));
  const map = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) map[bvids[i]] = r.value;
  });
  return map;
}

export { getVideoInfo, getAudioUrl, getSeasonArchives, checkVideoSeason, batchCheckVideoSeason };
