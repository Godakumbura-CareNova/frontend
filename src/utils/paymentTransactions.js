export const TRANSACTION_CATEGORIES = [
  { value: 'All', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Successful', label: 'Successful' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Rejected', label: 'Rejected' },
];

export const PAYMENT_STATUS_LABELS = {
  AwaitingOnlinePayment: 'Awaiting online payment',
  AwaitingBankTransfer: 'Awaiting bank transfer',
  PayOnCollection: 'Pay on collection',
  ReceiptUnderVerification: 'Receipt under verification',
  ReceiptRejected: 'Receipt rejected',
  Paid: 'Paid',
  Failed: 'Failed',
};

export const paymentStatusLabel = (status) => PAYMENT_STATUS_LABELS[status] || status || '';

export const STATUS_ACTIONS = {
  Paid: { label: 'Mark as paid', confirm: 'Mark this payment as paid? The order will show as paid to staff and the patient.' },
  Failed: { label: 'Mark as not paid', confirm: 'Mark this payment as not paid? The patient will need to choose a payment method again.' },
};

// Where the transactions pages live for the signed-in role.
export const transactionsBasePath = (pathname = '') =>
  (pathname.startsWith('/admin') ? '/admin/payments' : '/pharmacy/payment-transactions');

// Turns a failed request into a message, and whether trying again can help.
export const describeTransactionError = (failure, fallback) => {
  const status = failure?.response?.status;
  const message = failure?.response?.data?.message;
  if (status === 401) return { message: 'Your session has expired. Please sign in again.', retryable: false };
  if (status === 403) return { message: 'You do not have permission to manage payment transactions.', retryable: false };
  if (status === 404) return { message: message || 'We could not find that payment transaction.', retryable: false };
  if (status === 400 || status === 409 || status === 422) return { message: message || fallback, retryable: false };
  return { message: fallback, retryable: true };
};

export const ORDER_STATUS_LABELS = {
  Pending: 'Pending',
  ReadyForCollection: 'Ready for collection',
  Collected: 'Collected',
  Rejected: 'Rejected',
};

export const orderStatusLabel = (status) => ORDER_STATUS_LABELS[status] || status || '';

export const ORDER_STATUS_ACTIONS = {
  ReadyForCollection: { label: 'Mark ready for collection', confirm: 'Mark this order as ready for collection? The patient will be notified.' },
  Rejected: { label: 'Reject order', confirm: 'Reject this order? The patient will be notified with your reason.' },
  Collected: { label: 'Mark collected', confirm: 'Mark this order as collected? The patient will be notified.' },
};

export const EVENT_STATUS_TEXT = { Published: 'Kafka event sent', Queued: 'Kafka event queued', Failed: 'Kafka event failed to send' };

export const NOTIFICATION_STATUS_TEXT = { Delivered: 'Patient notified', Pending: 'Notification pending', Failed: 'Notification failed' };
