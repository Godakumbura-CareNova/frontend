import axios from 'axios';

export const appointmentApi = axios.create({
  baseURL:
    import.meta.env.VITE_APPOINTMENT_API_BASE_URL ||
    'http://localhost:5136',
});

appointmentApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('carenova_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});