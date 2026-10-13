import axios from 'axios';
const homeApi = axios.create({ baseURL: import.meta.env.VITE_PUBLIC_API_BASE_URL || import.meta.env.VITE_APPOINTMENT_API_BASE_URL || 'http://localhost:5136', timeout: 15000 });
export const getHomeContent = async () => (await homeApi.get('/api/public/home')).data;
