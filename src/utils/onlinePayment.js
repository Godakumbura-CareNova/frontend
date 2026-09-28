// GCN-41: helpers for the PayHere online payment page.

// PayHere's checkout script. It opens PayHere's own payment window; card details are typed there, never in CareNova.
export const PAYHERE_SCRIPT_URL = 'https://www.payhere.lk/lib/payhere.js';

// PayHere sandbox test cards (any future expiry date, any CVV). The full list is in PayHere's sandbox documentation.
export const SANDBOX_TEST_CARDS = [
  { brand: 'Visa', number: '4916 2175 0161 1292', result: 'Payment succeeds', tone: 'success' },
  { brand: 'Mastercard', number: '5307 7321 2553 1191', result: 'Payment succeeds', tone: 'success' },
  { brand: 'Visa', number: '4024 0071 9434 9121', result: 'Insufficient funds', tone: 'failed' },
  { brand: 'Visa', number: '4929 7689 0083 7248', result: 'Do not honor (declined)', tone: 'failed' },
];

export const ATTEMPT_STATUS_TEXT = { Pending: 'In progress', Succeeded: 'Successful', Failed: 'Failed', Cancelled: 'Failed' };

const NAME_PATTERN = /^\s*\p{L}[\p{L} .'-]*\s*$/u;
const PHONE_PATTERN = /^\s*(\+94|0094|94|0)[ -]?\d{2}[ -]?\d{3}[ -]?\d{4}\s*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The billing details PayHere requires, with the same messages as the server. Returns { field: message } for problems.
export const validateBilling = (billing) => {
  const errors = {};
  const name = (field, label, max) => {
    const value = (billing[field] || '').trim();
    if (!value) errors[field] = `Enter your ${label}.`;
    else if (value.length > max) errors[field] = `Keep your ${label} to ${max} characters or fewer.`;
    else if (!NAME_PATTERN.test(value)) errors[field] = `Your ${label} can only contain letters, spaces, dots, apostrophes and hyphens.`;
  };
  name('firstName', 'first name', 50);
  name('lastName', 'last name', 50);
  const email = (billing.email || '').trim();
  if (!email) errors.email = 'Enter your email address.';
  else if (email.length > 100 || !EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';
  const phone = (billing.phone || '').trim();
  if (!phone) errors.phone = 'Enter your phone number.';
  else if (!PHONE_PATTERN.test(phone)) errors.phone = 'Enter a valid Sri Lankan phone number, e.g. 0771234567 or +94771234567.';
  const address = (billing.address || '').trim();
  if (!address) errors.address = 'Enter your address.';
  else if (address.length > 100) errors.address = 'Keep your address to 100 characters or fewer.';
  name('city', 'city', 50);
  return errors;
};

// Splits the profile's full name into first and last name for the billing form.
export const splitFullName = (fullName = '') => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
};

// Loads PayHere's script once; rejects when it cannot be reached (the payment service is then unavailable).
let payHereLoader = null;
export const loadPayHere = () => {
  if (window.payhere) return Promise.resolve(window.payhere);
  if (!payHereLoader) {
    payHereLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PAYHERE_SCRIPT_URL;
      script.async = true;
      script.onload = () => (window.payhere ? resolve(window.payhere) : reject(new Error('PayHere did not load.')));
      script.onerror = () => { payHereLoader = null; script.remove(); reject(new Error('PayHere could not be reached.')); };
      document.body.appendChild(script);
    });
  }
  return payHereLoader;
};

// Turns a failed request into a message, and whether trying again can help.
export const describeOnlinePaymentError = (failure, fallback) => {
  const status = failure?.response?.status;
  const message = failure?.response?.data?.message;
  if (status === 401) return { message: 'Your session has expired. Please sign in again.', retryable: false };
  if (status === 403) return { message: 'Only patients can pay for medicine orders.', retryable: false };
  if (status === 503) return { message: message || 'The online payment service is unavailable right now. Please try again shortly.', retryable: true };
  if (status === 400 || status === 404 || status === 409 || status === 422) return { message: message || fallback, retryable: false };
  if (!failure?.response) return { message: 'We could not reach the payment service. Check your connection and try again.', retryable: true };
  return { message: fallback, retryable: true };
};
