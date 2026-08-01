/**
 * User Store — 用户状态管理
 *
 * 职责：
 * - B站登录状态管理（登录检测、登出）
 * - 收藏夹设置持久化
 * - 收藏状态管理（已收藏 bvid 集合）
 */

import { defineStore } from 'pinia';
import { ref, shallowRef, computed, triggerRef } from 'vue';
import { useToast } from './toast';

const FAV_FOLDER_KEY = 'bilimusic_fav_folder';

export const useUserStore = defineStore('user', () => {
  // ══════════════════════════════════════════
  //  状态
  // ══════════════════════════════════════════

  const loggedIn = ref(false);
  const uid = ref('');
  const nickname = ref('');
  const avatar = ref('');
  const level = ref(0);
  const favFolderId = ref(null); // 当前选中的收藏夹 ID
  const favFolderName = ref(''); // 当前选中的收藏夹名称
  const favoritedBvids = shallowRef(new Set()); // 已收藏的 bvid 集合（shallowRef 避免深层响应式开销）
  const favoritedCount = computed(() => favoritedBvids.value.size);

  const { showToast } = useToast();

  /** 从 localStorage 加载收藏夹设置 */
  function loadFavFolderSetting() {
    try {
      const val = localStorage.getItem(FAV_FOLDER_KEY);
      if (val) {
        const parsed = JSON.parse(val);
        favFolderId.value = parsed.id;
        favFolderName.value = parsed.name;
        if (favFolderId.value) {
          loadFavoritedBvids();
        }
      }
    } catch {
      /* ignore */
    }
  }

  function saveFavFolderSetting(id, name) {
    favFolderId.value = id;
    favFolderName.value = name;
    localStorage.setItem(FAV_FOLDER_KEY, JSON.stringify({ id, name }));
    if (id) {
      loadFavoritedBvids();
    } else {
      favoritedBvids.value = new Set();
      triggerRef(favoritedBvids);
    }
  }

  function isFavorited(bvid) {
    return favoritedBvids.value.has(bvid);
  }

  async function loadFavoritedBvids() {
    if (!loggedIn.value || !favFolderId.value) return;
    try {
      // 先取第一页得到总数，再按需并行拉取剩余页（最多 5 页 / 100 条）
      const firstPage = await window.electronAPI
        .listFavResources(favFolderId.value, 1, 20)
        .catch(() => null);
      const total = firstPage?.total || 0;
      const pageCount = Math.min(Math.max(Math.ceil(total / 20), 1), 5);
      const pagePromises = [];
      for (let p = 1; p <= pageCount; p++) {
        pagePromises.push(
          p === 1
            ? Promise.resolve(firstPage?.resources || [])
            : window.electronAPI
                .listFavResources(favFolderId.value, p, 20)
                .then((result) => result?.resources || [])
                .catch(() => [])
        );
      }
      const allPages = await Promise.all(pagePromises);
      const allBvids = [];
      for (const resources of allPages) {
        for (const r of resources) {
          if (r.bvid) allBvids.push(r);
        }
      }
      syncFavoritedBvids(allBvids);
    } catch (e) {
      console.error('[BiliMusic] Load favorited status failed:', e);
    }
  }

  async function toggleFav(item) {
    if (!loggedIn.value || !favFolderId.value) return { success: false };
    const bvid = item.bvid;
    const isFav = isFavorited(bvid);
    // Bilibili API 对于 type=2（视频）需要传 AID（数字ID）作为 rid
    const rid = item.aid || item.bvid;
    try {
      if (isFav) {
        const result = await window.electronAPI.removeFav(rid, favFolderId.value);
        if (result?.success) {
          favoritedBvids.value.delete(bvid);
          triggerRef(favoritedBvids);
          showToast('已取消收藏', 'success');
          return { success: true, action: 'removed' };
        } else {
          const errMsg = result?.error || '未知错误';
          console.error('[BiliMusic] Unfavorite failed:', errMsg);
          showToast('取消收藏失败: ' + errMsg, 'error');
        }
      } else {
        const result = await window.electronAPI.addFav(rid, favFolderId.value);
        if (result?.success) {
          favoritedBvids.value.add(bvid);
          triggerRef(favoritedBvids);
          showToast('已收藏', 'success');
          return { success: true, action: 'added' };
        } else {
          const errMsg = result?.error || '未知错误';
          console.error('[BiliMusic] Favorite failed:', errMsg);
          showToast('收藏失败: ' + errMsg, 'error');
        }
      }
    } catch (e) {
      console.error('[BiliMusic] Favorite toggle failed:', e);
      showToast('收藏操作失败: ' + e.message, 'error');
    }
    return { success: false };
  }

  async function checkLogin() {
    try {
      const result = await window.electronAPI.checkLogin();
      if (result.loggedIn) {
        loggedIn.value = true;
        uid.value = result.uid;
        nickname.value = result.nickname;
        avatar.value = result.avatar;
        level.value = result.level || 0;
        loadFavFolderSetting();
      } else {
        reset();
      }
      return result;
    } catch {
      reset();
      return { loggedIn: false };
    }
  }

  async function logout() {
    try {
      await window.electronAPI.logout();
      reset();
    } catch (e) {
      console.error('[BiliMusic] Logout failed:', e);
    }
  }

  function reset() {
    loggedIn.value = false;
    uid.value = '';
    nickname.value = '';
    avatar.value = '';
    level.value = 0;
    favFolderId.value = null;
    favFolderName.value = '';
    favoritedBvids.value = new Set();
    triggerRef(favoritedBvids);
    localStorage.removeItem(FAV_FOLDER_KEY);
  }

  function syncFavoritedBvids(bvidsArray) {
    const set = favoritedBvids.value;
    for (const r of bvidsArray) {
      if (r.bvid) set.add(r.bvid);
    }
    triggerRef(favoritedBvids);
  }

  return {
    loggedIn,
    uid,
    nickname,
    avatar,
    level,
    favFolderId,
    favFolderName,
    favoritedBvids,
    favoritedCount,
    checkLogin,
    logout,
    reset,
    loadFavFolderSetting,
    saveFavFolderSetting,
    isFavorited,
    loadFavoritedBvids,
    toggleFav,
    syncFavoritedBvids,
  };
});
