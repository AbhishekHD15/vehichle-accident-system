import api from './api'
export const adminService = {
  users: () => api.get('/users').then((r) => r.data),
  createUser: (b) => api.post('/users', b).then((r) => r.data),
  updateUser: (id, b) => api.patch(`/users/${id}`, b).then((r) => r.data),
  resetPassword: (id, new_password) => api.post(`/users/${id}/reset-password`, { new_password }),
  devices: () => api.get('/admin/devices').then((r) => r.data),
  createDevice: (b) => api.post('/admin/devices', b).then((r) => r.data),
  updateDevice: (id, b) => api.patch(`/admin/devices/${id}`, b).then((r) => r.data),
  rotateKey: (id) => api.post(`/admin/devices/${id}/rotate-key`).then((r) => r.data),
  auditLogs: (params) => api.get('/admin/audit-logs', { params }).then((r) => r.data),
}
