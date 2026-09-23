// Consultation fees are stored as plain decimals in the doctor-payment service; the platform currency is LKR.
export const CONSULTATION_FEE_CURRENCY = 'LKR';

/** "LKR 2,500.00" for a numeric fee, or null when the doctor has not set one. */
export const formatConsultationFee = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return `${CONSULTATION_FEE_CURRENCY} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
