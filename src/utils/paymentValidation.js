export const PAYMENT_METHOD_LABELS = {
  Online: 'Online payment',
  BankTransfer: 'Bank transfer',
  Cash: 'Cash',
};

// The message to show before a method choice is sent, or '' when it may go ahead.
export const validatePaymentSelection = (method, methods = []) => {
  if (!method) return 'Select a payment method to continue.';
  const option = methods.find((item) => item.method === method);
  if (!option) return 'Select a payment method to continue.';
  if (!option.available) return option.unavailableReason || `${option.label} is not available right now. Please choose another payment method.`;
  return '';
};

// Turns a failed payment request into a message, and whether trying the same thing again can help.
export const describePaymentError = (failure, fallback) => {
  const status = failure?.response?.status;
  const message = failure?.response?.data?.message;
  if (status === 401) return { message: 'Your session has expired. Please sign in again.', retryable: false };
  if (status === 403) return { message: 'Only patients can pay for medicine orders.', retryable: false };
  if (status === 404) return { message: message || 'We could not find this order.', retryable: false };
  if (status === 400 || status === 409 || status === 422) return { message: message || fallback, retryable: false };
  return { message: fallback, retryable: true };
};
