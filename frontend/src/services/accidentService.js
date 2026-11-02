import api from './api'
export const clean = (p = {}) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v != null))
export const accidentService = {
  list: (params) => api.get('/accidents', { params: clean(params) }).then((r) => r.data),
  get: (id) => api.get(`/accidents/${id}`).then((r) => r.data),
  update: (id, body) => api.patch(`/accidents/${id}`, body).then((r) => r.data),
}
