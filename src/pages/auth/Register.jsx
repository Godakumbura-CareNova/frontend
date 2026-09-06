import React, { useState } from 'react';
import pharmacyLogo from '../../assets/PHARMACY LOGO .jpeg';
import { registerCustomer } from '../../services/authService';

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  mobileNumber: '',
  landPhoneNumber: '',
  address: '',
  dateOfBirth: '',
  gender: '',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeServerField = (field) => {
  const key = String(field || '').trim();
  const map = {
    fullName: 'fullName',
    FullName: 'fullName',
    firstName: 'firstName',
    FirstName: 'firstName',
    lastName: 'lastName',
    LastName: 'lastName',
    email: 'email',
    Email: 'email',
    password: 'password',
    Password: 'password',
    confirmPassword: 'confirmPassword',
    ConfirmPassword: 'confirmPassword',
    mobileNumber: 'mobileNumber',
    MobileNumber: 'mobileNumber',
    landPhoneNumber: 'landPhoneNumber',
    LandPhoneNumber: 'landPhoneNumber',
    address: 'address',
    Address: 'address',
    dateOfBirth: 'dateOfBirth',
    DateOfBirth: 'dateOfBirth',
    gender: 'gender',
    Gender: 'gender',
  };

  return map[key] || null;
};

const getAge = (dateOfBirth) => {
  if (!dateOfBirth) return 0;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
};

const validateForm = (values) => {
  const nextErrors = {};

  ['fullName', 'email', 'password', 'confirmPassword', 'mobileNumber', 'landPhoneNumber', 'address', 'dateOfBirth', 'gender'].forEach((field) => {
    const value = values[field];
    if (typeof value === 'string' && !value.trim()) {
      nextErrors[field] = 'This field is required.';
    }
  });

  if (!nextErrors.fullName && values.fullName.trim().length < 2) {
    nextErrors.fullName = 'Full name must be at least 2 characters.';
  }

  if (!nextErrors.email && !EMAIL_REGEX.test(values.email.trim())) {
    nextErrors.email = 'Enter a valid email address.';
  }

  if (!nextErrors.password) {
    const password = values.password;
    const hasMinimumLength = password.length >= 6;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!(hasMinimumLength && hasUppercase && hasLowercase && hasNumber && hasSpecial)) {
      nextErrors.password = 'Use 6+ characters with uppercase, lowercase, number, and special character.';
    }
  }

  if (!nextErrors.confirmPassword && values.confirmPassword !== values.password) {
    nextErrors.confirmPassword = 'Passwords do not match.';
  }

  if (!nextErrors.dateOfBirth) {
    const birthDate = new Date(values.dateOfBirth);
    if (Number.isNaN(birthDate.getTime()) || birthDate >= new Date()) {
      nextErrors.dateOfBirth = 'Date of birth must be in the past.';
    } else if (getAge(values.dateOfBirth) < 16) {
      nextErrors.dateOfBirth = 'You must be at least 16 years old.';
    }
  }

  if (!nextErrors.gender && !['Male', 'Female', 'Other'].includes(values.gender)) {
    nextErrors.gender = 'Please select a valid gender.';
  }

  return nextErrors;
};

const BrandMark = () => (
  <img src={pharmacyLogo} alt="Godakumbura CareNova logo" className="brand-logo-image" />
);

const Register = () => {
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: '' }));
    }
    if (formError) {
      setFormError('');
    }
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const nextErrors = validateForm(formData);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        password: formData.password.trim(),
        confirmPassword: formData.confirmPassword.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        landPhoneNumber: formData.landPhoneNumber.trim(),
        address: formData.address.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
      };

      await registerCustomer(payload);
      setSuccessMessage('Registration successful! Your account has been created.');
    } catch (error) {
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.message;
      const serverErrors = error?.response?.data?.errors || {};

      if (status === 409) {
        setErrors((current) => ({
          ...current,
          email: 'already registered',
        }));
        setFormError(backendMessage || 'Registration failed. Please check your details and try again.');
        return;
      }

      if (status === 400) {
        const mappedErrors = {};
        Object.entries(serverErrors).forEach(([field, messages]) => {
          const normalizedField = normalizeServerField(field);
          if (normalizedField && Array.isArray(messages) && messages.length > 0) {
            mappedErrors[normalizedField] = messages[0];
          }
        });

        if (Object.keys(mappedErrors).length > 0) {
          setErrors(mappedErrors);
          return;
        }
      }

      setFormError(backendMessage || 'Registration failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registration-page">
      <div className="registration-card">
        <div className="registration-header">
          <div className="header-brand-wrap">
            <div className="brand-mark-shell">
              <BrandMark />
            </div>
            <div className="brand-text-wrap">
              <p className="brand-title">Godakumbura CareNova</p>
              <p className="brand-subtitle">Smart ePharmacy and doctor channelling system</p>
            </div>
          </div>
        </div>

        <div className="registration-body">
          <h2 className="registration-title">Create your account</h2>
          <p className="registration-subtitle">Personal details for your CareNova profile</p>

          {successMessage && <div className="alert registration-success">{successMessage}</div>}
          {formError && <div className="alert alert-error">{formError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-row form-row-single">
              <label className="field-label" htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                className="field-input"
                placeholder="Kamala Silva"
                value={formData.fullName}
                onChange={handleChange}
                aria-invalid={Boolean(errors.fullName)}
              />
              {errors.fullName && <span className="field-error">{errors.fullName}</span>}
            </div>

            <div className="form-row form-row-single">
              <label className="field-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                name="email"
                className="field-input"
                placeholder="kamala.silva@example.com"
                value={formData.email}
                onChange={handleChange}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="form-row form-row-single">
              <label className="field-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                className="field-input"
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleChange}
                aria-invalid={Boolean(errors.password)}
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <div className="form-row form-row-single">
              <label className="field-label" htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                className="field-input"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                aria-invalid={Boolean(errors.confirmPassword)}
              />
              {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
            </div>

            <div className="form-row two-column">
              <div>
                <label className="field-label" htmlFor="mobileNumber">Mobile number</label>
                <input
                  id="mobileNumber"
                  type="tel"
                  name="mobileNumber"
                  className="field-input"
                  placeholder="0771234567"
                  value={formData.mobileNumber}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.mobileNumber)}
                />
                {errors.mobileNumber && <span className="field-error">{errors.mobileNumber}</span>}
              </div>
              <div>
                <label className="field-label" htmlFor="landPhoneNumber">Land phone number</label>
                <input
                  id="landPhoneNumber"
                  type="tel"
                  name="landPhoneNumber"
                  className="field-input"
                  placeholder="0571234567"
                  value={formData.landPhoneNumber}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.landPhoneNumber)}
                />
                {errors.landPhoneNumber && <span className="field-error">{errors.landPhoneNumber}</span>}
              </div>
            </div>

            <div className="form-row form-row-single">
              <label className="field-label" htmlFor="address">Address</label>
              <textarea
                id="address"
                rows="2"
                name="address"
                className="field-input textarea-input"
                placeholder="No. 5, Temple Road, Welimada"
                value={formData.address}
                onChange={handleChange}
                aria-invalid={Boolean(errors.address)}
              />
              {errors.address && <span className="field-error">{errors.address}</span>}
            </div>

            <div className="form-row two-column">
              <div>
                <label className="field-label" htmlFor="dateOfBirth">Date of birth</label>
                <input
                  id="dateOfBirth"
                  type="date"
                  name="dateOfBirth"
                  className="field-input"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.dateOfBirth)}
                />
                {errors.dateOfBirth && <span className="field-error">{errors.dateOfBirth}</span>}
              </div>
              <div>
                <label className="field-label" htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  className="field-input"
                  value={formData.gender}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.gender)}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.gender && <span className="field-error">{errors.gender}</span>}
              </div>
            </div>

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>

            <p className="login-link-text">
              Already have an account? <a href="/login">Log in</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
