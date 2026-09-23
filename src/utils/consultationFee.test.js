import { describe, expect, it } from 'vitest';
import { formatConsultationFee } from './consultationFee';

describe('formatConsultationFee', () => {
  it('formats amounts in LKR with two decimals and thousands separators', () => {
    expect(formatConsultationFee(2500)).toBe('LKR 2,500.00');
    expect(formatConsultationFee(3500.5)).toBe('LKR 3,500.50');
    expect(formatConsultationFee('1999.99')).toBe('LKR 1,999.99');
    expect(formatConsultationFee(0)).toBe('LKR 0.00');
  });

  it('returns null when no fee is set', () => {
    expect(formatConsultationFee(null)).toBeNull();
    expect(formatConsultationFee(undefined)).toBeNull();
    expect(formatConsultationFee('')).toBeNull();
    expect(formatConsultationFee('abc')).toBeNull();
  });
});
