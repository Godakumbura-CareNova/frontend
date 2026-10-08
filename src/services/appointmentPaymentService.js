import { appointmentApi } from '../api/appointmentApi';

const paymentPath = (appointmentId) =>
  `/api/appointments/${encodeURIComponent(appointmentId)}/payment`;

const staffPaymentPath =
  '/api/staff/appointment-payments';

export const getAppointmentPayment = async (appointmentId) => {
  const response = await appointmentApi.get(
    paymentPath(appointmentId)
  );

  return response.data;
};

export const selectAppointmentPaymentMethod = async (
  appointmentId,
  method
) => {
  const response = await appointmentApi.post(
    `${paymentPath(appointmentId)}/method`,
    { method }
  );

  return response.data;
};

export const uploadAppointmentReceipt = async (
  appointmentId,
  file
) => {
  const form = new FormData();
  form.append('receipt', file);

  const response = await appointmentApi.post(
    `${paymentPath(appointmentId)}/receipt`,
    form
  );

  return response.data;
};

export const startAppointmentOnlinePayment = async (
  appointmentId,
  billing
) => {
  const response = await appointmentApi.post(
    `${paymentPath(appointmentId)}/online/start`,
    billing
  );

  return response.data;
};

export const getAppointmentOnlinePaymentResult = async (
  appointmentId,
  attemptId
) => {
  const response = await appointmentApi.get(
    `${paymentPath(appointmentId)}/online/${encodeURIComponent(attemptId)}`
  );

  return response.data;
};

export const cancelAppointmentOnlinePayment = async (
  appointmentId,
  attemptId
) => {
  const response = await appointmentApi.post(
    `${paymentPath(appointmentId)}/online/${encodeURIComponent(attemptId)}/cancel`
  );

  return response.data;
};

export const getPendingAppointmentReceipts = async () => {
  const response = await appointmentApi.get(
    `${staffPaymentPath}/receipts`
  );

  return response.data;
};

export const getAppointmentReceiptFile = async (
  receiptId
) => {
  const response = await appointmentApi.get(
    `${staffPaymentPath}/receipts/${encodeURIComponent(receiptId)}/file`,
    {
      responseType: 'blob'
    }
  );

  return response.data;
};

export const verifyAppointmentReceipt = async (
  appointmentId,
  approved,
  rejectionReason = null
) => {
  const response = await appointmentApi.post(
    `${staffPaymentPath}/appointments/${encodeURIComponent(
      appointmentId
    )}/receipt/verify`,
    {
      approved,
      rejectionReason
    }
  );

  return response.data;
};