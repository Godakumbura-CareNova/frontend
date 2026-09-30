// Client-side rules for the doctor professional profile form.
// Mirrors UpdateDoctorProfileValidator in the doctor-payment service so users get instant
// feedback; the backend remains the source of truth.

export const DOCTOR_PROFILE_MIN_YEAR = 1950;
export const DOCTOR_PROFILE_MAX_ENTRIES = 20;
export const CONSULTATION_FEE_MAX = 1000000;

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

// Optional; blank means "not set". Otherwise a non-negative amount with at most two decimals.
export const validateConsultationFee = (value) => {
  const text = trimmed(value);
  if (text === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'Enter the fee as a number with at most 2 decimal places, e.g. 2500 or 2500.50.';
  const amount = Number(text);
  if (amount > CONSULTATION_FEE_MAX) return `Consultation fee must not exceed ${CONSULTATION_FEE_MAX.toLocaleString('en-US')}.`;
  return null;
};

/**
 * A requested new fee (GCN-38). Unlike validateConsultationFee it is required, must be above 0 and must differ
 * from the doctor's current fee. Mirrors CreateFeeChangeRequestValidator. Returns a message or null.
 */
export const validateRequestedFee = (value, currentFee) => {
  const text = trimmed(value);
  if (text === '') return 'Enter the new consultation fee.';
  // Checked before the format rule so "-2000" gets a clear reason rather than a generic format message.
  if (/^-\s*\d/.test(text)) return 'Consultation fee cannot be negative. Enter an amount greater than 0.';
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'Enter the fee as a number with at most 2 decimal places, e.g. 2500 or 2500.50.';
  const amount = Number(text);
  if (amount <= 0) return 'Consultation fee must be greater than 0.';
  if (amount > CONSULTATION_FEE_MAX) return `Consultation fee must not exceed ${CONSULTATION_FEE_MAX.toLocaleString('en-US')}.`;
  if (currentFee !== null && currentFee !== undefined && Number(currentFee) === amount) {
    return 'This is already your consultation fee. Enter a different amount.';
  }
  return null;
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

  const feeError = validateConsultationFee(form.consultationFee);
  if (feeError) errors.consultationFee = feeError;

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
  consultationFee: trimmed(form.consultationFee) === '' ? null : Number(trimmed(form.consultationFee)),
  profilePicturePath: trimmed(form.profilePicturePath) || null,
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

// Client-side rules for the patient doctor search. Mirrors DoctorSearchQueryValidator in the doctor-payment service.
export const DOCTOR_SEARCH_MIN_LENGTH = 2;
export const DOCTOR_SEARCH_MAX_LENGTH = 100;

const SEARCH_TEXT_PATTERN = /^[\p{L}\p{N} .,'&/()-]+$/u;

/**
 * Validates the search form. Empty criteria are valid (they list every doctor); non-empty text must look like a
 * name or specialization. Returns { isValid, errors } keyed by field, like validateDoctorProfileForm.
 */
export const validateDoctorSearchCriteria = (criteria) => {
  const errors = {};
  const search = trimmed(criteria?.search);
  const specialization = trimmed(criteria?.specialization);

  if (search !== '') {
    if (search.length < DOCTOR_SEARCH_MIN_LENGTH) {
      errors.search = `Enter at least ${DOCTOR_SEARCH_MIN_LENGTH} characters to search.`;
    } else if (search.length > DOCTOR_SEARCH_MAX_LENGTH) {
      errors.search = `Search text must not exceed ${DOCTOR_SEARCH_MAX_LENGTH} characters.`;
    } else if (!SEARCH_TEXT_PATTERN.test(search)) {
      errors.search = "Use only letters, numbers, spaces and . , ' & / ( ) - characters.";
    }
  }

  if (specialization !== '' && (specialization.length > DOCTOR_SEARCH_MAX_LENGTH || !SEARCH_TEXT_PATTERN.test(specialization))) {
    errors.specialization = 'Please choose a valid specialization.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

// Client-side rules for publishing consultation availability. Mirrors CreateAvailabilityValidator plus the
// service's "must be in the future / at most 90 days ahead" checks so doctors get instant feedback.
export const AVAILABILITY_MIN_SLOT_MINUTES = 10;
export const AVAILABILITY_MAX_SLOT_MINUTES = 240;
export const AVAILABILITY_MAX_WINDOW_HOURS = 12;
export const AVAILABILITY_MAX_DAYS_AHEAD = 90;
export const AVAILABILITY_SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];

// Doctors type the hour and minutes and choose AM / PM from a list.
export const AVAILABILITY_MERIDIEM_OPTIONS = ['AM', 'PM'];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TWO_DIGITS = /^\d{1,2}$/;

/**
 * Explains what is wrong with a typed hour / minutes, or null when both are fine or both are blank
 * (blank is reported by the form validator as "time is required").
 */
export const typedTimeError = (hour, minute) => {
  const hourText = trimmed(hour);
  const minuteText = trimmed(minute);
  if (hourText === '' && minuteText === '') return null;

  if (hourText === '') return 'Enter the hour (1 to 12).';
  if (!TWO_DIGITS.test(hourText) || Number(hourText) < 1 || Number(hourText) > 12) return 'Hour must be a number from 1 to 12.';
  if (minuteText === '') return 'Enter the minutes (00 to 59).';
  if (!TWO_DIGITS.test(minuteText) || Number(minuteText) > 59) return 'Minutes must be a number from 00 to 59.';
  return null;
};

/**
 * Turns the typed hour / minutes and chosen AM-PM into the "HH:mm" value the rest of the validation works with.
 * Blank stays '' (reads as "required"); anything invalid becomes 'invalid' so the validator rejects it.
 */
export const to24HourTime = (hour, minute, meridiem) => {
  if (trimmed(hour) === '' && trimmed(minute) === '') return '';
  if (typedTimeError(hour, minute)) return 'invalid';

  const period = trimmed(meridiem).toUpperCase();
  if (period !== 'AM' && period !== 'PM') return 'invalid';

  const hours24 = (Number(trimmed(hour)) % 12) + (period === 'PM' ? 12 : 0);
  return `${String(hours24).padStart(2, '0')}:${String(Number(trimmed(minute))).padStart(2, '0')}`;
};

/** Combines the date and time inputs (which are in the doctor's local zone) into a Date, or null when incomplete/invalid. */
export const combineLocalDateTime = (date, time) => {
  if (!DATE_PATTERN.test(trimmed(date)) || !TIME_PATTERN.test(trimmed(time))) return null;
  const [year, month, day] = trimmed(date).split('-').map(Number);
  const [hours, minutes] = trimmed(time).split(':').map(Number);
  const value = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(value.getTime()) ? null : value;
};

/**
 * Validates { date, startTime, endTime, slotDurationMinutes }. Returns { isValid, errors } keyed by field.
 * `now` is injectable for tests.
 */
export const validateAvailabilityForm = (form, now = new Date()) => {
  const errors = {};
  const date = trimmed(form?.date);
  const startTime = trimmed(form?.startTime);
  const endTime = trimmed(form?.endTime);
  const duration = Number(trimmed(form?.slotDurationMinutes));

  if (date === '') errors.date = 'Date is required.';
  else if (!DATE_PATTERN.test(date)) errors.date = 'Enter a valid date.';

  if (startTime === '') errors.startTime = 'Start time is required.';
  else if (!TIME_PATTERN.test(startTime)) errors.startTime = 'Enter a valid start time, for example 9:30 AM.';

  if (endTime === '') errors.endTime = 'End time is required.';
  else if (!TIME_PATTERN.test(endTime)) errors.endTime = 'Enter a valid end time, for example 10:00 AM.';

  if (!Number.isInteger(duration) || duration < AVAILABILITY_MIN_SLOT_MINUTES || duration > AVAILABILITY_MAX_SLOT_MINUTES) {
    errors.slotDurationMinutes = `Slot length must be between ${AVAILABILITY_MIN_SLOT_MINUTES} and ${AVAILABILITY_MAX_SLOT_MINUTES} minutes.`;
  }

  const start = combineLocalDateTime(date, startTime);
  const end = combineLocalDateTime(date, endTime);
  if (start && end) {
    const windowMinutes = (end - start) / 60000;
    if (windowMinutes <= 0) {
      errors.endTime = 'End time must be after the start time.';
    } else if (windowMinutes > AVAILABILITY_MAX_WINDOW_HOURS * 60) {
      errors.endTime = `An availability window cannot be longer than ${AVAILABILITY_MAX_WINDOW_HOURS} hours.`;
    } else if (!errors.slotDurationMinutes && duration > windowMinutes) {
      errors.slotDurationMinutes = 'Slot length must fit inside the availability window.';
    }
  }

  if (start && !errors.date && !errors.startTime) {
    if (start <= now) {
      errors.startTime = 'Availability must start in the future.';
    } else if (start - now > AVAILABILITY_MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
      errors.date = `Availability can be published at most ${AVAILABILITY_MAX_DAYS_AHEAD} days ahead.`;
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

/** Converts the local date/time inputs into the UTC request body the API expects. */
export const toAvailabilityRequest = (form) => ({
  startUtc: combineLocalDateTime(form.date, form.startTime).toISOString(),
  endUtc: combineLocalDateTime(form.date, form.endTime).toISOString(),
  slotDurationMinutes: Number(trimmed(form.slotDurationMinutes)),
});

/** How many slots the window will produce, so the confirmation can say what is about to be published. */
export const countAvailabilitySlots = (form) => {
  const start = combineLocalDateTime(form?.date, form?.startTime);
  const end = combineLocalDateTime(form?.date, form?.endTime);
  const duration = Number(trimmed(form?.slotDurationMinutes));

  if (!start || !end || !Number.isInteger(duration) || duration <= 0) return 0;
  const windowMinutes = (end - start) / 60000;
  return windowMinutes <= 0 ? 0 : Math.floor(windowMinutes / duration);
};

/**
 * Validates editing one slot: { date, startTime, endTime }. Same time rules as publishing a window, except the
 * slot's own length must be between the minimum and maximum slot length. `now` is injectable for tests.
 */
export const validateAvailabilitySlotEdit = (form, now = new Date()) => {
  const errors = {};
  const date = trimmed(form?.date);
  const startTime = trimmed(form?.startTime);
  const endTime = trimmed(form?.endTime);

  if (date === '') errors.date = 'Date is required.';
  else if (!DATE_PATTERN.test(date)) errors.date = 'Enter a valid date.';

  if (startTime === '') errors.startTime = 'Start time is required.';
  else if (!TIME_PATTERN.test(startTime)) errors.startTime = 'Enter a valid start time, for example 9:30 AM.';

  if (endTime === '') errors.endTime = 'End time is required.';
  else if (!TIME_PATTERN.test(endTime)) errors.endTime = 'Enter a valid end time, for example 10:00 AM.';

  const start = combineLocalDateTime(date, startTime);
  const end = combineLocalDateTime(date, endTime);
  if (start && end) {
    const slotMinutes = (end - start) / 60000;
    if (slotMinutes <= 0) errors.endTime = 'End time must be after the start time.';
    else if (slotMinutes < AVAILABILITY_MIN_SLOT_MINUTES) errors.endTime = `A slot must be at least ${AVAILABILITY_MIN_SLOT_MINUTES} minutes long.`;
    else if (slotMinutes > AVAILABILITY_MAX_SLOT_MINUTES) errors.endTime = `A slot cannot be longer than ${AVAILABILITY_MAX_SLOT_MINUTES} minutes.`;
  }

  if (start && !errors.date && !errors.startTime) {
    if (start <= now) {
      errors.startTime = 'Availability must start in the future.';
    } else if (start - now > AVAILABILITY_MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
      errors.date = `Availability can be published at most ${AVAILABILITY_MAX_DAYS_AHEAD} days ahead.`;
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

/** Converts an edited slot's local date/time inputs into the UTC body for PUT /availability/{id}. */
export const toAvailabilitySlotUpdateRequest = (form) => ({
  startUtc: combineLocalDateTime(form.date, form.startTime).toISOString(),
  endUtc: combineLocalDateTime(form.date, form.endTime).toISOString(),
});

/**
 * The first existing slot that overlaps [start, end), ignoring `ignoreSlotId` (the slot being edited).
 * Touching edges do not count, matching the service. Lets the form warn before the request is sent.
 */
export const findConflictingSlot = (start, end, slots, ignoreSlotId = null) => {
  if (!(start instanceof Date) || !(end instanceof Date) || !Array.isArray(slots)) return null;
  // API times are UTC; a value without a zone suffix is still UTC.
  const parseUtc = (value) => new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(String(value)) ? value : `${value}Z`);
  return slots.find((slot) => (
    slot.id !== ignoreSlotId && parseUtc(slot.startUtc) < end && parseUtc(slot.endUtc) > start
  )) ?? null;
};
