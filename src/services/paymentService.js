import { doctorPaymentApi } from "../api/doctorPaymentApi.js";

const orderPath = (orderId) => `/api/medicine-orders/${encodeURIComponent(orderId)}`;

// The payment methods for a checkout total, before the order is placed. The server re-checks the choice against the order.
export const getMedicinePaymentMethods = (amount) =>
  doctorPaymentApi.get("/api/medicine-payments/methods", { params: { amount } });

// The payment methods for one pharmacy order, each marked available or not, plus any method already chosen.
export const getMedicinePaymentOptions = (orderId) =>
  doctorPaymentApi.get(`${orderPath(orderId)}/payment-options`);

// Chooses (or changes) how the order is paid; the response says what happens next.
export const selectMedicinePaymentMethod = (orderId, method) =>
  doctorPaymentApi.put(`${orderPath(orderId)}/payment`, { method });

// The method already chosen for the order; 404 when none has been chosen.
export const getMedicinePayment = (orderId) =>
  doctorPaymentApi.get(`${orderPath(orderId)}/payment`);
