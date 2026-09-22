// Client-side rules for the doctor professional profile form.
// Mirrors UpdateDoctorProfileValidator in the doctor-payment service so users get instant
// feedback; the backend remains the source of truth.

export const DOCTOR_PROFILE_MIN_YEAR = 1950;
export const DOCTOR_PROFILE_MAX_ENTRIES = 20;

const REGISTRATION_NUMBER_PATTERN = /^[A-Za-z0-9/-]{3,50}$/;

const currentYear = () => new Date().getFullYear();

const trimmed = (value) => (value ?? '').toString().trim();

const parseYear = (value) => {
  const text = trimmed(value);
  if (text === '') return null;
  const year = Number(text);
  return Number.isInteger(year) ? year : Number.NaN;
};

const validateYears = (entry, errors, prefix) => {
  const maxYear = currentYear();
  const startYear = parseYear(entry.startYear);
  const endYear = parseYear(entry.endYear);

  if (startYear === null) {
    errors[`${prefix}.startYear`] = 'Start year is required.';
  } else if (Number.isNaN(startYear) || startYear < DOCTOR_PROFILE_MIN_YEAR || startYear > maxYear) {
    errors[`${prefix}.startYear`] = `Start year must be between ${DOCTOR_PROFILE_MIN_YEAR} and ${maxYear}.`;
  }

  if (endYear !== null) {
    if (Number.isNaN(endYear) || endYear > maxYear) {
      errors[`${prefix}.endYear`] = `End year must not be later than ${maxYear}.`;
    } else if (startYear !== null && !Number.isNaN(startYear) && endYear < startYear) {
      errors[`${prefix}.endYear`] = 'End year must be on or after the start year.';
    }
  }
};

const validateText = (value, errors, key, label, min, max) => {
  const text = trimmed(value);
  if (text.length === 0) errors[key] = `${label} is required.`;
  else if (text.length < min) errors[key] = `${label} must be at least ${min} characters.`;
  else if (text.length > max) errors[key] = `${label} must not exceed ${max} characters.`;
};

export const validateDoctorProfileForm = (form) => {
  const errors = {};

  validateText(form.specialization, errors, 'specialization', 'Specialization', 2, 100);

  const registrationNumber = trimmed(form.registrationNumber);
  if (registrationNumber.length === 0) {
    errors.registrationNumber = 'Medical registration number is required.';
  } else if (!REGISTRATION_NUMBER_PATTERN.test(registrationNumber)) {
    errors.registrationNumber = 'Use 3 to 50 letters, digits, slashes or hyphens.';
  }

  if (trimmed(form.biography).length > 2000) {
    errors.biography = 'Biography must not exceed 2000 characters.';
  }

  const qualifications = Array.isArray(form.qualifications) ? form.qualifications : [];
  if (qualifications.length > DOCTOR_PROFILE_MAX_ENTRIES) {
    errors.qualifications = `At most ${DOCTOR_PROFILE_MAX_ENTRIES} qualifications can be recorded.`;
  }
  qualifications.forEach((item, index) => {
    const prefix = `qualifications[${index}]`;
    validateText(item.degree, errors, `${prefix}.degree`, 'Degree', 2, 100);
    validateText(item.institution, errors, `${prefix}.institution`, 'Institution', 2, 150);
    validateYears(item, errors, prefix);
  });

  const experiences = Array.isArray(form.experiences) ? form.experiences : [];
  if (experiences.length > DOCTOR_PROFILE_MAX_ENTRIES) {
    errors.experiences = `At most ${DOCTOR_PROFILE_MAX_ENTRIES} experience entries can be recorded.`;
  }
  experiences.forEach((item, index) => {
    const prefix = `experiences[${index}]`;
    validateText(item.position, errors, `${prefix}.position`, 'Position', 2, 100);
    validateText(item.organization, errors, `${prefix}.organization`, 'Organization', 2, 150);
    validateYears(item, errors, prefix);
  });

  // "Other" is an optional section (memberships, awards, publications...); entries that exist must be complete.
  const otherDetails = Array.isArray(form.otherDetails) ? form.otherDetails : [];
  if (otherDetails.length > DOCTOR_PROFILE_MAX_ENTRIES) {
    errors.otherDetails = `At most ${DOCTOR_PROFILE_MAX_ENTRIES} other details can be recorded.`;
  }
  otherDetails.forEach((item, index) => {
    const prefix = `otherDetails[${index}]`;
    validateText(item.title, errors, `${prefix}.title`, 'Title', 2, 100);
    if (trimmed(item.details).length > 300) errors[`${prefix}.details`] = 'Details must not exceed 300 characters.';
    validateYears(item, errors, prefix);
  });

  return { isValid: Object.keys(errors).length === 0, errors };
};

/**
 * Converts the form state (strings from inputs) into the request body the API expects.
 * Empty end years become null, which the API treats as "in progress" / "present".
 */
export const toDoctorProfileRequest = (form) => ({
  specialization: trimmed(form.specialization),
  registrationNumber: trimmed(form.registrationNumber).toUpperCase(),
  biography: trimmed(form.biography) || null,
  qualifications: (form.qualifications || []).map((item) => ({
    degree: trimmed(item.degree),
    institution: trimmed(item.institution),
    startYear: Number(trimmed(item.startYear)),
    endYear: trimmed(item.endYear) === '' ? null : Number(trimmed(item.endYear)),
  })),
  experiences: (form.experiences || []).map((item) => ({
    position: trimmed(item.position),
    organization: trimmed(item.organization),
    startYear: Number(trimmed(item.startYear)),
    endYear: trimmed(item.endYear) === '' ? null : Number(trimmed(item.endYear)),
  })),
  otherDetails: (form.otherDetails || []).map((item) => ({
    title: trimmed(item.title),
    details: trimmed(item.details) || null,
    startYear: Number(trimmed(item.startYear)),
    endYear: trimmed(item.endYear) === '' ? null : Number(trimmed(item.endYear)),
  })),
});

/**
 * Maps server-side validation keys ("Qualifications[0].Degree") onto the camelCase keys
 * used by the form ("qualifications[0].degree") so they can be shown next to the right field.
 */
export const mapServerValidationErrors = (serverErrors) => {
  if (!serverErrors || typeof serverErrors !== 'object') return {};

  return Object.entries(serverErrors).reduce((mapped, [key, messages]) => {
    const normalizedKey = key
      .split('.')
      .map((segment) => segment.charAt(0).toLowerCase() + segment.slice(1))
      .join('.');
    const message = Array.isArray(messages) ? messages[0] : String(messages);
    if (message) mapped[normalizedKey] = message;
    return mapped;
  }, {});
};
