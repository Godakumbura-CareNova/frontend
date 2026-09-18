import { doctorPaymentApi } from "../api/doctorPaymentApi.js";

export const createPayment = (payload) =>
  doctorPaymentApi.post("/api/payments", payload);
