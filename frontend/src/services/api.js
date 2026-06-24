import axios from 'axios';

// /api/* -> backend:8000/* via Vite proxy
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the JWT token to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Clear the token and redirect to login on 401 errors
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authApi = {
  login: (formData) =>
    api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  register: (data) => api.post('/auth/register', data),
};

// AI analysis endpoints
export const promptApi = {
  analyze: (data) => api.post('/prompt/analyze', data),
  // data: { original_text, sector, answers: { question: answer } }
  clarify: (data) => api.post('/prompt/analyze/clarify', data),
};

// Schema approval endpoints
export const schemaApi = {
  approve: (data) => api.post('/schema/approve', data),
};

// Configuration endpoints
export const configurationsApi = {
  list: () => api.get('/configurations/list'),
  delete: (configId) => api.delete(`/configurations/${configId}`),
  addManualModule: (configId, data) =>
    api.post(`/configurations/${configId}/modules/manual`, data),
};

// User profile endpoints
export const userApi = {
  getMe:          () => api.get('/auth/me'),
  updateProfile:  (data) => api.patch('/users/me', data),
  changePassword: (data) => api.post('/users/me/change-password', data),
  getStats:       () => api.get('/users/me/stats'),
};

// Admin endpoints (admin role only)
export const adminApi = {
  getHealth:         () => api.get('/admin/health'),
  overview:          () => api.get('/admin/overview'),
  users:             () => api.get('/admin/users'),
  tenants:           () => api.get('/admin/tenants'),
  configurations:    () => api.get('/admin/configurations'),
  logs:              () => api.get('/admin/logs'),
  diagnostics:              () => api.get('/admin/diagnostics'),
  resolveDiagnostic:        (diagId) => api.patch(`/admin/diagnostics/${diagId}/resolve`),
  getSectorDistribution:    () => api.get('/admin/analytics/sector-distribution'),
  getTopTenants:            (limit = 5) => api.get('/admin/analytics/top-tenants', { params: { limit } }),
  getConfidenceDistribution: () => api.get('/admin/analytics/confidence-distribution'),
};

// Module and record endpoints
export const modulesApi = {
  list: (configId = null) => configId
    ? api.get('/modules/list', { params: { config_id: configId } })
    : api.get('/modules/list'),
  getSchema: (mapId) => api.get(`/modules/${mapId}/schema`),
  getRecords: (mapId, params = {}) => api.get(`/modules/${mapId}/records`, { params }),
  // Backend RecordCreateRequest: { data: {...} }
  createRecord: (mapId, data) => api.post(`/modules/${mapId}/records`, { data }),
  // Backend RecordUpdateRequest: { data: {...} }
  updateRecord: (mapId, recordId, data) =>
    api.put(`/modules/${mapId}/records/${recordId}`, { data }),
  deleteRecord: (mapId, recordId) =>
    api.delete(`/modules/${mapId}/records/${recordId}`),
};

export default api;
