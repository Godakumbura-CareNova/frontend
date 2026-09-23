import { describe, expect, it } from 'vitest';
import {
  DOCTOR_PROFILE_MAX_ENTRIES,
  DOCTOR_SEARCH_MAX_LENGTH,
  combineLocalDateTime,
  countAvailabilitySlots,
  mapServerValidationErrors,
  to24HourTime,
  toAvailabilityRequest,
  validateAvailabilityForm,
  validateConsultationFee,
  validateDoctorSearchCriteria,
  toDoctorProfileRequest,
  validateDoctorProfileForm,
} from './doctorValidation';

const currentYear = new Date().getFullYear();

const validForm = () => ({
  specialization: 'General Practitioner',
  registrationNumber: 'SLMC-12345',
  biography: 'Family medicine.',
  consultationFee: '2500',
  qualifications: [{ degree: 'MBBS', institution: 'University of Colombo', startYear: '2010', endYear: '2015' }],
  experiences: [{ position: 'Senior Medical Officer', organization: 'District General Hospital, Colombo', startYear: '2016', endYear: '' }],
  otherDetails: [{ title: 'Member, Sri Lanka Medical Association', details: '', startYear: '2018', endYear: '' }],
});

describe('validateDoctorProfileForm', () => {
  it('accepts a complete, valid form', () => {
    const result = validateDoctorProfileForm(validForm());
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('accepts an empty qualifications and experience list', () => {
    const form = { ...validForm(), qualifications: [], experiences: [] };
    expect(validateDoctorProfileForm(form).isValid).toBe(true);
  });

  it('requires specialization and registration number', () => {
    const form = { ...validForm(), specialization: '   ', registrationNumber: '' };
    const { isValid, errors } = validateDoctorProfileForm(form);
    expect(isValid).toBe(false);
    expect(errors.specialization).toBe('Specialization is required.');
    expect(errors.registrationNumber).toBe('Medical registration number is required.');
  });

  it('rejects a registration number with spaces or symbols', () => {
    const form = { ...validForm(), registrationNumber: 'SLMC 12#' };
    expect(validateDoctorProfileForm(form).errors.registrationNumber).toMatch(/letters, digits, slashes or hyphens/);
  });

  it('flags missing qualification fields with indexed keys', () => {
    const form = validForm();
    form.qualifications[0].degree = '';
    form.qualifications[0].startYear = '';
    const { errors } = validateDoctorProfileForm(form);
    expect(errors['qualifications[0].degree']).toBe('Degree is required.');
    expect(errors['qualifications[0].startYear']).toBe('Start year is required.');
  });

  it('rejects year ranges that are out of order or in the future', () => {
    const form = validForm();
    form.experiences[0].startYear = '2018';
    form.experiences[0].endYear = '2016';
    form.qualifications[0].startYear = String(currentYear + 1);
    const { errors } = validateDoctorProfileForm(form);
    expect(errors['experiences[0].endYear']).toBe('End year must be on or after the start year.');
    expect(errors['qualifications[0].startYear']).toContain(`between 1950 and ${currentYear}`);
  });

  it('treats the Other section as optional, but validates entries that exist', () => {
    const form = validForm();
    form.otherDetails = [];
    expect(validateDoctorProfileForm(form).isValid).toBe(true);

    delete form.otherDetails;
    expect(validateDoctorProfileForm(form).isValid).toBe(true);

    form.otherDetails = [{ title: '', details: 'x'.repeat(301), startYear: '', endYear: '' }];
    const { errors } = validateDoctorProfileForm(form);
    expect(errors['otherDetails[0].title']).toBe('Title is required.');
    expect(errors['otherDetails[0].details']).toBe('Details must not exceed 300 characters.');
    expect(errors['otherDetails[0].startYear']).toBe('Start year is required.');
  });

  it('rejects non-numeric years', () => {
    const form = validForm();
    form.qualifications[0].startYear = 'abcd';
    expect(validateDoctorProfileForm(form).errors['qualifications[0].startYear']).toBeTruthy();
  });

  it('limits the number of entries', () => {
    const form = validForm();
    form.qualifications = Array.from({ length: DOCTOR_PROFILE_MAX_ENTRIES + 1 }, () => ({ ...validForm().qualifications[0] }));
    expect(validateDoctorProfileForm(form).errors.qualifications).toContain(`At most ${DOCTOR_PROFILE_MAX_ENTRIES}`);
  });
});

describe('validateConsultationFee', () => {
  it.each(['', '  ', undefined, null, '0', '2500', '2500.5', '1999.99', '1000000'])('accepts %p', (value) => {
    expect(validateConsultationFee(value)).toBeNull();
    expect(validateDoctorProfileForm({ ...validForm(), consultationFee: value }).errors.consultationFee).toBeUndefined();
  });

  it.each(['-1', 'abc', '12.345', '1,500', '1000000.01'])('rejects %p', (value) => {
    expect(validateConsultationFee(value)).toBeTruthy();
    expect(validateDoctorProfileForm({ ...validForm(), consultationFee: value }).errors.consultationFee).toBeTruthy();
  });
});

describe('to24HourTime', () => {
  it('converts a 12-hour selection, including both ends of the day', () => {
    expect(to24HourTime('9', '00', 'AM')).toBe('09:00');
    expect(to24HourTime('2', '30', 'PM')).toBe('14:30');
    expect(to24HourTime('12', '00', 'AM')).toBe('00:00');
    expect(to24HourTime('12', '15', 'PM')).toBe('12:15');
  });

  it('reads an incomplete or invalid selection as no time chosen', () => {
    expect(to24HourTime('', '00', 'AM')).toBe('');
    expect(to24HourTime('13', '00', 'AM')).toBe('');
    expect(to24HourTime('9', '00', '')).toBe('');
  });
});

describe('countAvailabilitySlots', () => {
  it('counts the whole slots a window produces, ignoring the remainder', () => {
    const form = { date: '2026-09-23', startTime: '09:00', endTime: '10:10', slotDurationMinutes: '20' };
    expect(countAvailabilitySlots(form)).toBe(3);
    expect(countAvailabilitySlots({ ...form, endTime: '09:10' })).toBe(0);
    expect(countAvailabilitySlots({ ...form, startTime: '' })).toBe(0);
  });
});

describe('validateAvailabilityForm', () => {
  const now = new Date(2026, 8, 22, 9, 0, 0);
  const valid = () => ({ date: '2026-09-23', startTime: '09:00', endTime: '11:00', slotDurationMinutes: '20' });

  it('accepts a future window with a slot that fits', () => {
    expect(validateAvailabilityForm(valid(), now)).toEqual({ isValid: true, errors: {} });
  });

  it('requires every field', () => {
    const { errors } = validateAvailabilityForm({ date: '', startTime: '', endTime: '', slotDurationMinutes: '' }, now);
    expect(errors.date).toBe('Date is required.');
    expect(errors.startTime).toBe('Start time is required.');
    expect(errors.endTime).toBe('End time is required.');
    expect(errors.slotDurationMinutes).toMatch(/between 10 and 240/);
  });

  it('rejects an end before the start and a window over 12 hours', () => {
    expect(validateAvailabilityForm({ ...valid(), endTime: '08:00' }, now).errors.endTime).toBe('End time must be after the start time.');
    expect(validateAvailabilityForm({ ...valid(), startTime: '06:00', endTime: '18:30' }, now).errors.endTime).toMatch(/12 hours/);
  });

  it('rejects a slot longer than the window', () => {
    expect(validateAvailabilityForm({ ...valid(), endTime: '09:15', slotDurationMinutes: '30' }, now).errors.slotDurationMinutes).toBe('Slot length must fit inside the availability window.');
  });

  it('rejects windows in the past or more than 90 days ahead', () => {
    expect(validateAvailabilityForm({ ...valid(), date: '2026-09-22', startTime: '08:00' }, now).errors.startTime).toBe('Availability must start in the future.');
    expect(validateAvailabilityForm({ ...valid(), date: '2027-01-15' }, now).errors.date).toMatch(/90 days/);
  });

  it('converts local date/time inputs into UTC ISO strings for the API', () => {
    expect(combineLocalDateTime('2026-09-23', '09:00')).toEqual(new Date(2026, 8, 23, 9, 0));
    expect(combineLocalDateTime('2026-09-23', '')).toBeNull();
    expect(toAvailabilityRequest(valid())).toEqual({
      startUtc: new Date(2026, 8, 23, 9, 0).toISOString(),
      endUtc: new Date(2026, 8, 23, 11, 0).toISOString(),
      slotDurationMinutes: 20,
    });
  });
});

describe('toDoctorProfileRequest', () => {
  it('sends the fee as a number, or null when blank', () => {
    expect(toDoctorProfileRequest({ ...validForm(), consultationFee: ' 2500.50 ' }).consultationFee).toBe(2500.5);
    expect(toDoctorProfileRequest({ ...validForm(), consultationFee: '' }).consultationFee).toBeNull();
    expect(toDoctorProfileRequest({ ...validForm(), consultationFee: undefined }).consultationFee).toBeNull();
  });

  it('trims text, upper-cases the registration number and converts years', () => {
    const form = validForm();
    form.specialization = '  Cardiologist ';
    form.registrationNumber = ' slmc-9 ';
    form.biography = '   ';
    const request = toDoctorProfileRequest(form);

    expect(request.specialization).toBe('Cardiologist');
    expect(request.registrationNumber).toBe('SLMC-9');
    expect(request.biography).toBeNull();
    expect(request.qualifications[0]).toEqual({ degree: 'MBBS', institution: 'University of Colombo', startYear: 2010, endYear: 2015 });
    expect(request.experiences[0].endYear).toBeNull();
    expect(request.experiences[0].startYear).toBe(2016);
    expect(request.otherDetails[0]).toEqual({ title: 'Member, Sri Lanka Medical Association', details: null, startYear: 2018, endYear: null });
  });

  it('sends trimmed Other details and an empty list when the section is unused', () => {
    const form = validForm();
    form.otherDetails[0].details = '  Life member  ';
    expect(toDoctorProfileRequest(form).otherDetails[0].details).toBe('Life member');

    delete form.otherDetails;
    expect(toDoctorProfileRequest(form).otherDetails).toEqual([]);
  });
});

describe('mapServerValidationErrors', () => {
  it('maps PascalCase and indexed keys onto form keys', () => {
    const mapped = mapServerValidationErrors({
      Specialization: ['Specialization is required.'],
      'Qualifications[0].Degree': ['Degree is required.', 'Second message'],
      'Experiences[1].EndYear': 'Bad year',
    });

    expect(mapped).toEqual({
      specialization: 'Specialization is required.',
      'qualifications[0].degree': 'Degree is required.',
      'experiences[1].endYear': 'Bad year',
    });
  });

  it('returns an empty object for missing input', () => {
    expect(mapServerValidationErrors(undefined)).toEqual({});
    expect(mapServerValidationErrors('oops')).toEqual({});
  });
});

describe('validateDoctorSearchCriteria', () => {
  it('accepts empty criteria (list everyone)', () => {
    expect(validateDoctorSearchCriteria({ search: '', specialization: '' })).toEqual({ isValid: true, errors: {} });
    expect(validateDoctorSearchCriteria({ search: '   ' })).toEqual({ isValid: true, errors: {} });
    expect(validateDoctorSearchCriteria(undefined)).toEqual({ isValid: true, errors: {} });
  });

  it.each(['Ni', 'Nimal Perera', "Dr. O'Neil-Smith", 'Ear, Nose & Throat', 'Cardiology (Adult)', '  padded  '])(
    'accepts names and specializations like %p',
    (search) => {
      expect(validateDoctorSearchCriteria({ search }).isValid).toBe(true);
    },
  );

  it('rejects a single character', () => {
    expect(validateDoctorSearchCriteria({ search: 'N' }).errors.search).toBe('Enter at least 2 characters to search.');
  });

  it('rejects text longer than the limit', () => {
    const { errors } = validateDoctorSearchCriteria({ search: 'a'.repeat(DOCTOR_SEARCH_MAX_LENGTH + 1) });
    expect(errors.search).toMatch(/must not exceed/);
  });

  it.each(['<script>', 'name; DROP', '50%', 'a_b'])('rejects unsupported characters in %p', (search) => {
    expect(validateDoctorSearchCriteria({ search }).errors.search).toMatch(/Use only letters/);
  });

  it('rejects an invalid specialization', () => {
    expect(validateDoctorSearchCriteria({ search: 'ok', specialization: 'Cardio*' }).errors.specialization).toBe('Please choose a valid specialization.');
  });
});
