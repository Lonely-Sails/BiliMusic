let cookies = []

const BASE_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function cookieString() {
  return cookies
    .filter((c) => !c.expires || c.expires > Date.now() / 1000)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
}

function parseSetCookie(setCookieArr) {
  if (!setCookieArr) return
  for (const sc of setCookieArr) {
    const parts = sc.split(';').map((p) => p.trim())
    const [name, ...rest] = parts[0].split('=')
    const value = rest.join('=')
    const existing = cookies.findIndex((c) => c.name === name)
    const entry = { name, value }

    for (let i = 1; i < parts.length; i++) {
      const [k, ...v] = parts[i].split('=')
      if (k.toLowerCase() === 'max-age') {
        entry.expires = Date.now() / 1000 + parseInt(v.join('='))
      } else if (k.toLowerCase() === 'expires') {
        entry.expires = new Date(v.join('=')).getTime() / 1000
      }
    }

    if (existing >= 0) {
      cookies[existing] = { ...cookies[existing], ...entry }
    } else {
      cookies.push(entry)
    }
  }
}

function clearCookies() {
  cookies = []
}

function loadSession(sessionData) {
  if (sessionData && sessionData.cookies) {
    cookies = sessionData.cookies
  }
}

function getSession() {
  return { cookies }
}

const REQUEST_TIMEOUT = 20000 // 20 seconds

async function apiFetch(url, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  const headers = {
    'User-Agent': BASE_UA,
    'Origin': 'https://www.bilibili.com',
    'Referer': 'https://www.bilibili.com',
    ...options.headers
  }

  const cookieStr = cookieString()
  if (cookieStr) headers['Cookie'] = cookieStr


  let resp
  try {
    resp = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeoutId)
  }

  // Parse set-cookie headers (supports multiple Set-Cookie headers)
  const allCookies = typeof resp.headers.getSetCookie === 'function'
    ? resp.headers.getSetCookie()
    : (resp.headers.get('set-cookie') ? [resp.headers.get('set-cookie')] : [])
  if (allCookies.length > 0) {
    parseSetCookie(allCookies)
  }

  return resp
}

async function apiGet(url, params = {}) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    searchParams.append(key, String(value))
  }
  const queryString = searchParams.toString()
  const fullUrl = queryString ? `${url}?${queryString}` : url

  const resp = await apiFetch(fullUrl, { method: 'GET' })
  return resp.json()
}

async function apiPost(url, data = {}) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(data)) {
    body.append(key, String(value))
  }

  const resp = await apiFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  })
  return resp.json()
}

export { apiGet, apiPost, apiFetch, loadSession, getSession, parseSetCookie, clearCookies }
