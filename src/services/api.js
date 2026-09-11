import axios from 'axios';
import { resolveApiBaseUrl } from '../utils/apiBaseUrl';

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
