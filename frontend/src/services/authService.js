import api, { tokenStore } from './api'

export const authService = {
  async login(email, password, remember) {
    const { data } = await api.post('/auth/login', { email, password })
    tokenStore.set(data.access_token, data.refresh_token, remember)
    return data.user
  },
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  async logout() {
    const rt = tokenStore.refresh
    try { if (rt) await api.post('/auth/logout', { refresh_token: rt }) } catch { /* ignore */ }
    tokenStore.clear()
  },
  updateProfile: (p) => api.patch('/users/me', p).then((r) => r.data),
}
