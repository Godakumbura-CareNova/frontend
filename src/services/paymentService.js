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

// Uploads the bank transfer receipt (JPG, JPEG or PNG up to 5 MB). The order stays Pending until staff verify it.
export const uploadBankTransferReceipt = (orderId, file) => {
  const form = new FormData();
  form.append("file", file);
  return doctorPaymentApi.post(`${orderPath(orderId)}/payment/receipt`, form);
};

// Pharmacy staff: bank transfer receipts to verify. Status is PendingVerification (default), Verified, Rejected or All.
export const listBankTransferReceipts = (status) =>
  doctorPaymentApi.get("/api/staff/bank-transfer-receipts", { params: status ? { status } : undefined });

export const getBankTransferReceiptFile = (receiptId) =>
  doctorPaymentApi.get(`/api/staff/bank-transfer-receipts/${encodeURIComponent(receiptId)}/file`, { responseType: "blob" });

export const verifyBankTransferReceipt = (receiptId) =>
  doctorPaymentApi.post(`/api/staff/bank-transfer-receipts/${encodeURIComponent(receiptId)}/verify`);

// GCN-42: approves a bank transfer. The server checks it against the order in the pharmacy; a transaction that does not
// match is refused (422) and flagged, and the response then carries the flagged receipt.
export const approveBankTransfer = (receiptId) =>
  doctorPaymentApi.post(`/api/staff/bank-transfer-receipts/${encodeURIComponent(receiptId)}/approve`, {});

export const rejectBankTransferReceipt = (receiptId, reason) =>
  doctorPaymentApi.post(`/api/staff/bank-transfer-receipts/${encodeURIComponent(receiptId)}/reject`, { reason });

// Notifications created from the Kafka "bank receipt uploaded" events.
export const listPaymentNotifications = () => doctorPaymentApi.get("/api/staff/payment-notifications");

export const markPaymentNotificationRead = (notificationId) =>
  doctorPaymentApi.put(`/api/staff/payment-notifications/${encodeURIComponent(notificationId)}/read`);

// Pharmacy staff and admins: medicine payment transactions. Status is Pending, Successful, Failed, Rejected or All.
export const listMedicinePaymentTransactions = ({ status, method, search } = {}) =>
  doctorPaymentApi.get("/api/staff/medicine-payments", {
    params: { status: status || undefined, method: method || undefined, search: search?.trim() || undefined },
  });

export const getMedicinePaymentTransaction = (paymentId) =>
  doctorPaymentApi.get(`/api/staff/medicine-payments/${encodeURIComponent(paymentId)}`);

// Marks a payment "Paid" or "Failed" (a note is required for Failed).
export const updateMedicinePaymentStatus = (paymentId, status, note) =>
  doctorPaymentApi.put(`/api/staff/medicine-payments/${encodeURIComponent(paymentId)}/status`, { status, note });

// Pharmacy staff: marks the order ReadyForCollection, Rejected (reason required) or Collected. A Kafka event is
// published and the patient notified.
export const updateMedicineOrderStatus = (paymentId, status, reason) =>
  doctorPaymentApi.put(`/api/staff/medicine-payments/${encodeURIComponent(paymentId)}/order-status`, { status, reason });

// The signed-in patient's order-status notifications from the doctor-payment service.
export const listPaymentPatientNotifications = () => doctorPaymentApi.get("/api/patient/notifications");

export const markPaymentPatientNotificationRead = (notificationId) =>
  doctorPaymentApi.put(`/api/patient/notifications/${encodeURIComponent(notificationId)}/read`);

export const markAllPaymentPatientNotificationsRead = () => doctorPaymentApi.put("/api/patient/notifications/read-all");

// Pharmacy staff and admins: orders that have been collected (completed), with their payments.
export const listCompletedMedicineOrders = (search) =>
  doctorPaymentApi.get("/api/staff/medicine-payments/completed", { params: { search: search?.trim() || undefined } });
