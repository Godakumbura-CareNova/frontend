export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

export const validatePassword = (password) => {
  return Boolean(password)
    && password.length >= 6
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
};

export const validateProfileForm = (formData) => {
  const errors = {};
  if (!formData.fullName || formData.fullName.trim().length < 2) errors.fullName = 'Full name must be at least 2 characters.';
  if (!/^(?:\+94|0)7[0-9]{8}$/.test(formData.mobileNumber || '')) errors.mobileNumber = 'Enter a valid Sri Lankan mobile number.';
  if (formData.landPhoneNumber && !/^(?:\+94|0)[1-9][0-9]{8}$/.test(formData.landPhoneNumber)) errors.landPhoneNumber = 'Enter a valid Sri Lankan land phone number.';
  if (!formData.address || !formData.address.trim()) errors.address = 'Address is required.';
  if (!formData.dateOfBirth || new Date(formData.dateOfBirth) >= new Date()) errors.dateOfBirth = 'Date of birth must be in the past.';
  if (!formData.gender || !['Male', 'Female', 'Other'].includes(formData.gender)) errors.gender = 'Please select a valid gender.';
  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validatePasswordChangeForm = (formData) => {
  const errors = {};
  if (!formData.currentPassword) errors.currentPassword = 'Current password is required.';
  if (!validatePassword(formData.newPassword)) errors.newPassword = 'Use 6+ characters with uppercase, lowercase, number, and special character.';
  if (formData.newPassword !== formData.confirmNewPassword) errors.confirmNewPassword = 'Passwords do not match.';
  return { isValid: Object.keys(errors).length === 0, errors };
};

const PROFILE_PICTURE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const PROFILE_PICTURE_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const PROFILE_PICTURE_ALLOWED_EXTENSIONS = /\.(jpe?g|png)$/i;

export const validateProfilePictureFile = (file) => {
  if (!file) {
    return { isValid: false, error: 'Please select a picture to upload.' };
  }

  const hasAllowedExtension = PROFILE_PICTURE_ALLOWED_EXTENSIONS.test(file.name || '');
  const hasAllowedType = !file.type || PROFILE_PICTURE_ALLOWED_TYPES.includes(file.type.toLowerCase());

  if (!hasAllowedExtension || !hasAllowedType) {
    return { isValid: false, error: 'Unsupported file format. Please upload a JPG, JPEG, or PNG file.' };
  }

  if (file.size > PROFILE_PICTURE_MAX_SIZE_BYTES) {
    return { isValid: false, error: 'File exceeds the maximum allowed size of 5 MB.' };
  }

  return { isValid: true, error: '' };
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
