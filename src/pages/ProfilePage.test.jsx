import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import { AuthProvider } from '../context/AuthContext';

const { mockGetProfile } = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
}));

vi.mock('../api/profileApi', () => ({
  default: {
    getProfile: mockGetProfile,
  },
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
  });

  it('loads and renders the profile returned by the backend', async () => {
    mockGetProfile.mockResolvedValue({
      UserId: 'user-123',
      Name: 'Taylor Morgan',
      Email: 'taylor@carenova.org',
      Role: 'Patient',
    });

    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Customer Profile' })).toBeInTheDocument();
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Taylor Morgan')).toBeInTheDocument();
    expect(screen.getByText('taylor@carenova.org')).toBeInTheDocument();
  });
});