import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DoctorAvatar, { doctorInitials, doctorPictureUrl } from './DoctorAvatar';

const path = '/uploads/profile-pictures/nimal.jpg';

describe('DoctorAvatar', () => {
  it('resolves a stored path against the user-auth host', () => {
    expect(doctorPictureUrl(path)).toMatch(/\/uploads\/profile-pictures\/nimal\.jpg$/);
    expect(doctorPictureUrl(path)).not.toContain('/api/uploads');
    expect(doctorPictureUrl(null)).toBeNull();
    expect(doctorPictureUrl('  ')).toBeNull();
  });

  it('shows the doctor picture when one has been recorded', () => {
    render(<DoctorAvatar picturePath={path} fullName="Nimal Perera" />);

    expect(screen.getByRole('img', { name: 'Dr. Nimal Perera' })).toHaveAttribute('src', doctorPictureUrl(path));
  });

  it('shows initials when the doctor has no picture', () => {
    render(<DoctorAvatar picturePath={null} fullName="Nimal Perera" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('NP')).toBeInTheDocument();
  });

  it('falls back to initials when the picture cannot be loaded', () => {
    render(<DoctorAvatar picturePath={path} fullName="Nimal Perera" />);

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
