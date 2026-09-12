import axios from 'axios';

const pharmacyApi = axios.create({
  baseURL: import.meta.env.VITE_PHARMACY_API_BASE_URL || 'http://localhost:5134/api',
});

pharmacyApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('carenova_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default pharmacyApi;
