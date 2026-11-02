import api from './api'
import { clean } from './accidentService'
export const claimService = {
  list: (params) => api.get('/claims', { params: clean(params) }).then((r) => r.data),
  get: (id) => api.get(`/claims/${id}`).then((r) => r.data),
  history: (id) => api.get(`/claims/${id}/history`).then((r) => r.data),
  create: (b) => api.post('/claims', b).then((r) => r.data),
  updateStatus: (id, b) => api.patch(`/claims/${id}/status`, b).then((r) => r.data),
}
