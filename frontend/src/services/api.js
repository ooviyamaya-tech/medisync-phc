import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000', timeout: 15000 });
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('medisync_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const dataOf = response => response.data?.data;
export const itemsOf = response => {
  const data = dataOf(response);
  return Array.isArray(data) ? data : data?.items || [];
};
export const apiError = error => error.response?.data?.error?.message || error.message || 'Something went wrong';

export const endpoints = {
  login: credentials => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
  dashboard: role => api.get(`/dashboard/${role === 'DISTRICT_ADMIN' ? 'district-admin' : role === 'MEDICAL_OFFICER' ? 'medical-officer' : 'pharmacist'}`),
  stock: params => api.get('/stock', { params: { limit: 100, ...params } }),
  addStock: body => api.post('/stock', body),
  updateStock: (id, body) => api.patch(`/stock/${id}`, body),
  consumption: params => api.get('/consumption', { params: { limit: 100, ...params } }),
  addConsumption: body => api.post('/consumption', body),
  forecast: (phcId, medicineId) => api.get(`/forecast/${phcId}/${medicineId}`),
  forecastAll: phcId => api.get(`/forecast/${phcId}`),
  alerts: params => api.get('/alerts', { params: { limit: 100, ...params } }),
  updateAlert: (id, status) => api.patch(`/alerts/${id}`, { status }),
  phcs: () => api.get('/phcs', { params: { limit: 100 } }),
  medicines: () => api.get('/medicines', { params: { limit: 100 } }),
  urgency: () => api.get('/centres/urgency'),
  redistribution: params => api.get('/redistribution/suggest', { params }),
  indent: params => api.get('/indent/suggest', { params }),
  transfers: params => api.get('/transfers', { params: { limit: 100, ...params } }),
  createTransfer: body => api.post('/transfers', body),
  decideTransfer: (id, decision, comment) => api.patch(`/transfers/${id}/${decision}`, { comment }),
};