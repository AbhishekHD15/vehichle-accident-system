import api from './api'
export const dashboardService = {
  get: (role) => api.get(`/dashboard/${role.toLowerCase()}`).then((r) => r.data),
}
