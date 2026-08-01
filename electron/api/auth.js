import fs from 'fs';
import { apiGet, apiPost, apiFetch, getSession, parseSetCookie, clearCookies } from './client.js';

let sessionPath = null;

function saveSession(filePath) {
  sessionPath = filePath;
  try {
    const session = getSession();
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
  } catch (e) {
    console.error('Failed to save session:', e);
  }
}

async function getQrcode() {
  const data = await apiGet('https://passport.bilibili.com/x/passport-login/web/qrcode/generate');

  if (data.code !== 0) {
    throw new Error(`QR code API error: ${data.code} - ${data.message}`);
  }

  return {
    url: data.data.url,
    qrcodeKey: data.data.qrcode_key,
  };
}

async function pollLogin(qrcodeKey) {
  const data = await apiGet('https://passport.bilibili.com/x/passport-login/web/qrcode/poll', {
    qrcode_key: qrcodeKey,
  });

  // code 0 = success (scanned and confirmed)
  // code 86101 = not scanned yet
  // code 86090 = scanned but not confirmed
  // code 86038 = expired

  const statusMap = {
    0: 'success',
    86101: 'pending',
    86090: 'scanning',
    86038: 'expired',
  };

  return {
    status: statusMap[data.code] || 'error',
    code: data.code,
    message: data.message,
    url: data.data?.url || null,
    refreshToken: data.data?.refresh_token || null,
  };
}

async function checkLogin() {
  const data = await apiGet('https://api.bilibili.com/x/web-interface/nav');

  if (data.code !== 0) {
    return { loggedIn: false };
  }

  const d = data.data;
  return {
    loggedIn: !!d.isLogin,
    uid: d.mid,
    nickname: d.uname,
    avatar: d.face,
    level: d.level_info?.current_level || 0,
    vipStatus: d.vipStatus === 1,
  };
}

async function logout() {
  try {
    await apiPost('https://passport.bilibili.com/x/passport-login/web/logout');
  } catch (e) {
    console.error('Logout API request failed:', e);
  }

  clearAuth();
  return { success: true };
}

/**
 * Complete SSO login by visiting the redirect URL from QR poll.
 * This is required to get the actual session cookies (SESSDATA, bili_jct, etc.).
 * Manually follows redirects to capture Set-Cookie headers at each step.
 */
async function completeLogin(ssoUrl) {
  if (!ssoUrl) return false;
  try {
    let url = ssoUrl;
    for (let i = 0; i < 10; i++) {
      const resp = await apiFetch(url, { method: 'GET', redirect: 'manual' });
      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location');
        if (!location) break;
        url = new URL(location, url).href;
        continue;
      }
      await resp.text();
      break;
    }

    // Visit Bilibili homepage to capture device cookies (buvid3, b_nut)
    await apiFetch('https://www.bilibili.com/', { method: 'GET' });

    // Explicitly fetch buvid3/buvid4 from fingerprint API and set as cookies
    try {
      const fp = await apiGet('https://api.bilibili.com/x/frontend/finger/spi');
      if (fp.code === 0 && fp.data) {
        if (fp.data.b_3) {
          parseSetCookie([`buvid3=${fp.data.b_3}; path=/; domain=.bilibili.com`]);
        }
        if (fp.data.b_4) {
          parseSetCookie([`buvid4=${fp.data.b_4}; path=/; domain=.bilibili.com`]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch fingerprint:', e);
    }

    // Generate b_nut (UNIX timestamp) as fallback if not already set via homepage
    const cookies = getSession().cookies;
    if (!cookies.find((c) => c.name === 'b_nut')) {
      parseSetCookie([`b_nut=${Math.floor(Date.now() / 1000)}; path=/; domain=.bilibili.com`]);
    }

    await apiFetch('https://api.bilibili.com/x/web-interface/nav', { method: 'GET' });

    return true;
  } catch (e) {
    console.error('SSO login failed:', e);
    return false;
  }
}

function clearAuth() {
  clearCookies();
  if (sessionPath) {
    try {
      fs.writeFileSync(sessionPath, JSON.stringify({ cookies: [] }));
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
  }
}

export { getQrcode, pollLogin, completeLogin, checkLogin, logout, saveSession, clearAuth };
