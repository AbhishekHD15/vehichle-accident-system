import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'

// "Remember me" => localStorage, otherwise sessionStorage. Trade-off: tokens in web storage are
// reachable by XSS; the access token is short-lived and refresh tokens rotate (see docs/SECURITY.md).
export const tokenStore = {
  get access() { return localStorage.getItem('at') || sessionStorage.getItem('at') },
  get refresh() { return localStorage.getItem('rt') || sessionStorage.getItem('rt') },
  set(access, refresh, remember) {
    this.clear()
    const s = remember ? localStorage : sessionStorage
    s.setItem('at', access); s.setItem('rt', refresh)
  },
  rotate(access, refresh) {
    const s = localStorage.getItem('rt') ? localStorage : sessionStorage
    s.setItem('at', access); s.setItem('rt', refresh)
  },
  clear() { ['at', 'rt'].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k) }) },
}

const api = axios.create({ baseURL: API_BASE, timeout: 20000 })

api.interceptors.request.use((cfg) => {
  const t = tokenStore.access
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

let refreshing = null
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    const isAuthCall = original?.url?.includes('/auth/')
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall && tokenStore.refresh) {
      original._retry = true
      try {
        refreshing = refreshing || axios.post(`${API_BASE}/auth/refresh`, { refresh_token: tokenStore.refresh })
        const { data } = await refreshing
        tokenStore.rotate(data.access_token, data.refresh_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        tokenStore.clear()
        window.dispatchEvent(new Event('auth:logout'))
      } finally { refreshing = null }
    }
    return Promise.reject(error)
  },
)

export const errMsg = (e, fallback = 'Something went wrong') => {
  const d = e?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => x.msg).join('; ')
  if (e?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.'
  return fallback
}

export default api
