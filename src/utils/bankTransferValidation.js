// GCN-42: helpers for the pharmacy staff bank transfer validation page.

// The queue's groups.
export const VALIDATION_GROUPS = [
  { value: 'All', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
];

export const receiptGroup = (receipt) => {
  if (receipt.status === 'Verified') return 'Approved';
  if (receipt.status === 'Rejected') return 'Rejected';
  return 'Pending';
};

export const GROUP_LABELS = {
  Pending: 'Pending verification',
  Approved: 'Approved',
  Rejected: 'Rejected',
};

// Common reasons a receipt cannot be verified; staff can pick one and edit it.
export const REJECTION_REASONS = [
  'The receipt is blurry or unclear, so the details cannot be read.',
  'The transferred amount does not match the order total.',
  'The transaction reference was not found in our bank statement.',
  'The receipt appears to be edited or is not a genuine bank receipt.',
  'The receipt is for a different account or payee.',
];

export const EVENT_TEXT = { Published: 'Kafka event sent', Queued: 'Kafka event queued', Failed: 'Kafka event failed to send' };

// Turns a failed request into a message, and whether trying again can help.
export const describeValidationError = (failure, fallback) => {
  const status = failure?.response?.status;
  const message = failure?.response?.data?.message;
  if (status === 401) return { message: 'Your session has expired. Please sign in again.', retryable: false };
  if (status === 403) return { message: 'You do not have permission to validate bank transfer transactions. Only pharmacy staff can do this.', retryable: false };
  if (status === 400 || status === 404 || status === 409 || status === 422) return { message: message || fallback, retryable: false };
  if (status === 503) return { message: message || 'The pharmacy system could not be reached. Please try again.', retryable: true };
  return { message: fallback, retryable: true };
};

// A receipt file request uses a blob response, so its error message has to be read out of the blob.
export const describeReceiptFileError = async (failure) => {
  const status = failure?.response?.status;
  if (status === 401 || status === 403) return describeValidationError(failure, '').message;
  try {
    const body = JSON.parse(await failure.response.data.text());
    if (body?.message) return body.message;
  } catch { /* Not a JSON body. */ }
  return 'The receipt could not be loaded. Check your connection and try again.';
};
