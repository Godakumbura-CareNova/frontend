import { describe, expect, it } from 'vitest';
import {
  DOCTOR_PROFILE_MAX_ENTRIES,
  DOCTOR_SEARCH_MAX_LENGTH,
  mapServerValidationErrors,
  validateDoctorSearchCriteria,
  toDoctorProfileRequest,
  validateDoctorProfileForm,
} from './doctorValidation';

const currentYear = new Date().getFullYear();

const validForm = () => ({
  specialization: 'General Practitioner',
  registrationNumber: 'SLMC-12345',
  biography: 'Family medicine.',
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

describe('toDoctorProfileRequest', () => {
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
