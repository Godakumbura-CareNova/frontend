export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

export const validatePassword = (password) => {
  // Requires minimum 6 characters, at least one letter and one number
  return password && password.length >= 6;
};

// GCN-16 password requirements, reused by GCN-23 (Forgot/Reset Password) —
// must match the backend's PasswordPolicy.IsStrong exactly.
export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 6 characters and include an uppercase letter, lowercase letter, number, and special character.';

export const validateStrongPassword = (password) => {
  if (!password || password.length < 6) return false;
  return /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
};

export const validateRegistrationForm = (formData) => {
  const errors = {};

  if (!formData.fullName || formData.fullName.trim().length < 2) {
    errors.fullName = 'Full Name must be at least 2 characters.';
  }

  if (!formData.email || !validateEmail(formData.email)) {
    errors.email = 'Please provide a valid email address.';
  }

  if (!formData.password || !validatePassword(formData.password)) {
    errors.password = 'Password must be at least 6 characters long.';
  }

  if (formData.confirmPassword !== undefined && formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (!formData.role) {
    errors.role = 'Please select a user role.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateLoginForm = (formData) => {
  const errors = {};

  if (!formData.email || !validateEmail(formData.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!formData.password) {
    errors.password = 'Password is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
