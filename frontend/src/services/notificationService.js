import api from './api'
import { clean } from './accidentService'
export const notificationService = {
  list: (params) => api.get('/notifications', { params: clean(params) }).then((r) => r.data),
  get: (id) => api.get(`/notifications/${id}`).then((r) => r.data),
  retry: (id) => api.post(`/notifications/${id}/retry`).then((r) => r.data),
}
