export const validPhone = value => !value.trim() || (/^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15);
export function validateInquiry(form) {
  const errors = {};
  for (const [name, label, limit] of [['name', 'Name', 120], ['email', 'Email', 254], ['subject', 'Subject', 200], ['message', 'Message', 5000]]) {
    if (!form[name]?.trim()) errors[name] = `${label} is required.`;
    else if (form[name].length > limit) errors[name] = `${label} must be ${limit} characters or fewer.`;
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (form.phone.length > 40 || !validPhone(form.phone)) errors.phone = 'Enter a valid phone number.';
  return errors;
}
export function inquiryServerErrors(error) {
  return Object.fromEntries(Object.entries(error.response?.data?.errors || {}).map(([key, messages]) => [key[0].toLowerCase() + key.slice(1), Array.isArray(messages) ? messages[0] : messages]));
}
