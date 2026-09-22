import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DoctorAvatar, { doctorInitials, doctorPictureUrl } from './DoctorAvatar';

describe('DoctorAvatar', () => {
  it('builds the picture URL on the user-auth host', () => {
    expect(doctorPictureUrl('abc-123')).toMatch(/\/api\/doctors\/abc-123\/picture$/);
    expect(doctorPictureUrl('abc-123')).not.toContain('/api/api/');
    expect(doctorPictureUrl(undefined)).toBeNull();
  });

  it('shows the doctor picture when a doctor id is known', () => {
    render(<DoctorAvatar doctorId="abc-123" fullName="Nimal Perera" />);

    const image = screen.getByRole('img', { name: 'Dr. Nimal Perera' });
    expect(image).toHaveAttribute('src', doctorPictureUrl('abc-123'));
  });

  it('falls back to initials when the picture cannot be loaded', () => {
    render(<DoctorAvatar doctorId="abc-123" fullName="Nimal Perera" />);

    fireEvent.error(screen.getByRole('img', { name: 'Dr. Nimal Perera' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('NP')).toBeInTheDocument();
  });

  it('computes initials', () => {
    expect(doctorInitials('Nimal Perera')).toBe('NP');
    expect(doctorInitials('Kamala')).toBe('K');
    expect(doctorInitials('')).toBe('Dr');
  });
});
