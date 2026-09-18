import axios from "axios";

export const doctorPaymentApi = axios.create({
  baseURL: import.meta.env.VITE_DOCTOR_PAYMENT_API_BASE_URL,
});
