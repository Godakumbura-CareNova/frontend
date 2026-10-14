export const APPOINTMENT_PAYMENT_METHODS = { Cash: 'Cash', BankTransfer: 'Bank transfer', PaymentGateway: 'Online payment' };
export const APPOINTMENT_PAYMENT_STATUSES = {
  Pending: 'Pending', AwaitingBankTransferReceipt: 'Awaiting bank transfer receipt',
  ReceiptUnderVerification: 'Receipt under verification', AwaitingGatewayPayment: 'Awaiting online payment',
  Successful: 'Successful', Failed: 'Failed',
};
export const appointmentPaymentLabel = payment => payment.category === 'Rejected'
  ? 'Receipt rejected' : APPOINTMENT_PAYMENT_STATUSES[payment.status] || 'Status unavailable';
export const appointmentDate = value => value ? new Date(value).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' }) : 'Not recorded';
