import { describe, expect, it } from 'vitest';
import { isSriLankanLandLine, isSriLankanMobile, normalizePhoneNumber, validateProfileForm } from './validation';

describe('phone number helpers', () => {
  it('strips spaces, hyphens, dots and brackets', () => {
    expect(normalizePhoneNumber('076 533 4492')).toBe('0765334492');
    expect(normalizePhoneNumber('076-533-4492')).toBe('0765334492');
    expect(normalizePhoneNumber('(076) 533.4492')).toBe('0765334492');
    expect(normalizePhoneNumber('+94 76 533 4492')).toBe('+94765334492');
    expect(normalizePhoneNumber(null)).toBe('');
  });

  it.each(['0765334492', '076 533 4492', '076-533-4492', '+94 76 533 4492'])('accepts mobile %p', (value) => {
    expect(isSriLankanMobile(value)).toBe(true);
  });

  it.each(['765334492', '0665334492', '07653344921', '076 533 44x2', ''])('rejects mobile %p', (value) => {
    expect(isSriLankanMobile(value)).toBe(false);
  });

  it.each(['0112914972', '011 291 4972', '+94 11 291 4972'])('accepts land line %p', (value) => {
    expect(isSriLankanLandLine(value)).toBe(true);
  });

  it('validateProfileForm accepts numbers typed with spaces', () => {
    const { errors } = validateProfileForm({
      fullName: 'Nimal Perera', mobileNumber: '076 533 4492', landPhoneNumber: '011 291 4972',
      address: 'Colombo', dateOfBirth: '1998-05-10', gender: 'Male',
    });
    expect(errors.mobileNumber).toBeUndefined();
    expect(errors.landPhoneNumber).toBeUndefined();
  });
});
