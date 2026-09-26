export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
export const RECEIPT_ACCEPT = '.jpg,.jpeg,.png,image/jpeg,image/png';

export const RECEIPT_MESSAGES = {
  missing: 'Select a receipt to upload.',
  format: 'Unsupported file format. Only JPG, JPEG and PNG files are allowed.',
  size: 'The receipt is larger than 5 MB. Please upload a file of 5 MB or less.',
};

// The message to show before a receipt is sent, or '' when it may be uploaded. The server checks the file again.
export const validateReceiptFile = (file) => {
  if (!file || !file.size) return RECEIPT_MESSAGES.missing;
  const name = (file.name || '').toLowerCase();
  if (!RECEIPT_EXTENSIONS.some((extension) => name.endsWith(extension))) return RECEIPT_MESSAGES.format;
  if (file.size > RECEIPT_MAX_BYTES) return RECEIPT_MESSAGES.size;
  return '';
};

// Turns a failed upload into a message, and whether trying again can help (network or server trouble).
export const describeReceiptUploadError = (failure) => {
  const status = failure?.response?.status;
  const message = failure?.response?.data?.message;
  if (status === 401) return { message: 'Your session has expired. Please sign in again.', retryable: false };
  if (status === 403) return { message: 'Only patients can upload payment receipts.', retryable: false };
  if (status === 413) return { message: RECEIPT_MESSAGES.size, retryable: false };
  if (status === 400 || status === 404 || status === 409 || status === 422) {
    return { message: message || 'We could not upload your receipt.', retryable: false };
  }
  return { message: message || 'We could not upload your receipt. Please try again.', retryable: true };
};

export const RECEIPT_STATUS_TEXT = {
  PendingVerification: 'Under verification',
  Verified: 'Verified',
  Rejected: 'Rejected',
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
