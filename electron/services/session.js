/**
 * B站会话服务 — 初始化设备标识并检查登录状态
 */

import { apiGet, parseSetCookie, getSession } from '../api/client.js';

async function ensureBiliSession() {
  try {
    const fingerprint = await apiGet('https://api.bilibili.com/x/frontend/finger/spi');
    if (fingerprint.code === 0 && fingerprint.data) {
      const cookies = getSession().cookies;
      if (fingerprint.data.b_3 && !cookies.find((cookie) => cookie.name === 'buvid3')) {
        parseSetCookie([`buvid3=${fingerprint.data.b_3}; path=/; domain=.bilibili.com`]);
      }
      if (fingerprint.data.b_4 && !cookies.find((cookie) => cookie.name === 'buvid4')) {
        parseSetCookie([`buvid4=${fingerprint.data.b_4}; path=/; domain=.bilibili.com`]);
      }
    }
  } catch {
    // The nav request below can still determine the current login state.
  }

  try {
    const navigation = await apiGet('https://api.bilibili.com/x/web-interface/nav');
    if (navigation.code === 0 && navigation.data) {
      return {
        loggedIn: !!navigation.data.isLogin,
        uid: navigation.data.mid || '',
        nickname: navigation.data.uname || '',
        avatar: navigation.data.face || '',
      };
    }
  } catch {
    // Return the stable anonymous state below when the network is unavailable.
  }

  return { loggedIn: false, uid: '', nickname: '', avatar: '' };
}

export { ensureBiliSession };
