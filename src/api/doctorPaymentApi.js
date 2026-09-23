import axios from "axios";

export const doctorPaymentApi = axios.create({
  baseURL: import.meta.env.VITE_DOCTOR_PAYMENT_API_BASE_URL || 'http://localhost:5135',
});

// The doctor-payment service validates the same JWT the user-auth service issues.
doctorPaymentApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("carenova_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
