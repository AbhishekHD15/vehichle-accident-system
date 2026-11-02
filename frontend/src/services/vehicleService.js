import api from './api'
export const vehicleService = {
  list: () => api.get('/vehicles').then((r) => r.data),
  get: (id) => api.get(`/vehicles/${id}`).then((r) => r.data),
  create: (b) => api.post('/vehicles', b).then((r) => r.data),
  update: (id, b) => api.put(`/vehicles/${id}`, b).then((r) => r.data),
  remove: (id) => api.delete(`/vehicles/${id}`),
  family: (id) => api.get(`/vehicles/${id}/family`).then((r) => r.data),
  share: (id, email) => api.post(`/vehicles/${id}/family`, { email }).then((r) => r.data),
  unshare: (id, uid) => api.delete(`/vehicles/${id}/family/${uid}`),
}
