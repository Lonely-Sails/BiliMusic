import { apiGet, apiPost, getSession } from './client.js';
import { invalidateFavCache } from './cache.js';

async function listFavFolders(upMid) {
  const params = {};
  if (upMid) params.up_mid = upMid;
  const data = await apiGet('https://api.bilibili.com/x/v3/fav/folder/created/list-all', params);

  if (data.code !== 0) {
    throw new Error(`Fav folders API error: ${data.code} - ${data.message}`);
  }

  const list = data.data?.list || data.data || [];
  const folders = (Array.isArray(list) ? list : []).map((f) => ({
    id: f.id,
    mediaId: f.id,
    title: f.title,
    cover: f.cover,
    mediaCount: f.media_count,
    description: f.intro,
    upper: f.upper ? { mid: f.upper.mid, name: f.upper.name, face: f.upper.face } : null,
  }));

  return folders;
}

async function listFavResources(mediaId, page = 1, pageSize = 20, upMid) {
  const params = {
    media_id: mediaId,
    pn: page,
    ps: pageSize,
    type: 2, // 2 = video
    platform: 'web',
  };
  if (upMid) params.up_mid = upMid;

  const data = await apiGet('https://api.bilibili.com/x/v3/fav/resource/list', params);

  if (data.code !== 0) {
    throw new Error(`Fav resources API error: ${data.code} - ${data.message}`);
  }

  const d = data.data;
  const resources = (d.medias || []).map((m) => ({
    bvid: m.bvid,
    aid: m.id,
    title: m.title,
    cover: m.cover,
    duration: m.duration,
    author: m.upper?.name,
    mid: m.upper?.mid,
    intro: m.intro,
    favTime: m.fav_time,
    page: m.page,
    cid: m.cid,
  }));

  return {
    resources,
    total: d.info?.media_count || resources.length,
    page,
    pageSize,
  };
}

async function addFav(rid, mediaId) {
  const session = getSession();
  const cookies = session.cookies || [];
  const biliJct = cookies.find((c) => c.name === 'bili_jct')?.value || '';

  const data = await apiPost('https://api.bilibili.com/x/v3/fav/resource/deal', {
    rid,
    type: 2,
    add_media_ids: mediaId,
    csrf: biliJct,
  });

  if (data.code !== 0) {
    throw new Error(`Add fav error: ${data.code} - ${data.message}`);
  }

  // 清除该收藏夹的所有分页缓存，确保下次进入能看到新收藏的视频
  invalidateFavCache(mediaId);

  return { success: true };
}

async function removeFav(rid, mediaId) {
  const session = getSession();
  const cookies = session.cookies || [];
  const biliJct = cookies.find((c) => c.name === 'bili_jct')?.value || '';

  const data = await apiPost('https://api.bilibili.com/x/v3/fav/resource/deal', {
    rid,
    type: 2,
    del_media_ids: mediaId,
    csrf: biliJct,
  });

  if (data.code !== 0) {
    throw new Error(`Remove fav error: ${data.code} - ${data.message}`);
  }

  // 清除该收藏夹的所有分页缓存，确保下次进入不再显示已取消收藏的视频
  invalidateFavCache(mediaId);

  return { success: true };
}

export { listFavFolders, listFavResources, addFav, removeFav };
