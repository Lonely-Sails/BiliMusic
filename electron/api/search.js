import { sign } from './sign.js';
import { apiGet } from './client.js';

async function searchVideo(keyword, page = 1, pageSize = 20, musicOnly = true) {
  const params = await sign({
    search_type: 'video',
    keyword,
    page,
    page_size: pageSize,
  });
  if (musicOnly) params.tids = 3; // 3 = music category, filters results to music videos only

  const data = await apiGet('https://api.bilibili.com/x/web-interface/wbi/search/type', params);

  if (data.code !== 0) {
    throw new Error(`Search API error: ${data.code} - ${data.message}`);
  }

  const result = data.data || {};

  const videos = (result.result || []).map((item) => ({
    bvid: item.bvid,
    aid: item.aid,
    title: item.title.replace(/<[^>]+>/g, ''), // Remove HTML tags
    cover: item.pic ? (item.pic.startsWith('//') ? 'https:' + item.pic : item.pic) : '',
    duration: item.duration,
    author: item.author,
    mid: item.mid,
    play: item.play,
    videoReview: item.video_review,
    favorites: item.favorites,
    tag: item.tag,
    description: item.description,
    create: item.create,
    cid: item.cid || null,
  }));

  return {
    videos,
    page: result.page || page,
    pageSize: result.pagesize || pageSize,
    total: result.numResults || result.total || videos.length,
    totalPages: result.numPages || 1,
  };
}

/**
 * 获取搜索建议词（输入联想）
 * GET https://s.search.bilibili.com/main/suggest?term=xxx
 */
async function getSearchSuggest(term) {
  const params = { term, func: 'suggest', suggest_type: 'accurate', sub_type: 'tag' };
  const data = await apiGet('https://s.search.bilibili.com/main/suggest', params);

  if (data.code !== 0) {
    return [];
  }

  const tags = data.result?.tag || [];
  return tags.map((t) => ({
    value: t.value,
    name: t.name.replace(/<[^>]+>/g, ''),
  }));
}

/**
 * 获取热搜列表（搜索框推荐）
 * 搜索时会自动限制音乐区（tids=3），此处仅展示热搜词供快速搜索
 * GET https://s.search.bilibili.com/main/hotword
 */
async function getHotSearch() {
  const data = await apiGet('https://s.search.bilibili.com/main/hotword');

  if (data.code !== 0) {
    return [];
  }

  const list = data.list || [];
  return list.map((item) => ({
    keyword: item.keyword,
    showName: item.show_name,
    icon: item.icon || '',
  }));
}

export { searchVideo, getSearchSuggest, getHotSearch };
