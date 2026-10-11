import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock('../context/AuthContext', () => ({ useAuth }));

const CurrentPath = () => <output>{useLocation().pathname}</output>;

describe('DashboardLayout', () => {
  it('opens doctor appointments from the sidebar', async () => {
    useAuth.mockReturnValue({ user: { fullName: 'Test Doctor' }, role: 'Doctor', logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/doctor-dashboard']}><DashboardLayout><CurrentPath /></DashboardLayout></MemoryRouter>);
    await user.click(screen.getByRole('link', { name: 'Appointments' }));
    expect(screen.getByText('/doctor/appointments')).toBeInTheDocument();
  });
  it('opens patient appointments from the sidebar', async () => {
    useAuth.mockReturnValue({ user: { fullName: 'Test Patient' }, role: 'Patient', logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/patient-dashboard']}><DashboardLayout><CurrentPath /></DashboardLayout></MemoryRouter>);
    await user.click(screen.getByRole('link', { name: 'Appointments' }));
    expect(screen.getByText('/patient/appointments')).toBeInTheDocument();
  });

  it('opens My cart from the patient top bar', async () => {
    useAuth.mockReturnValue({
      user: { fullName: 'GCN17' },
      role: 'Patient',
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/patient/medicines']}>
        <DashboardLayout><CurrentPath /></DashboardLayout>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'My cart' }));

    expect(screen.getByText('/patient/cart')).toBeInTheDocument();
  });

  it('opens the pharmacy notification menu for pharmacy staff', async () => {
    useAuth.mockReturnValue({
      user: { fullName: 'Pharmacy' },
      role: 'PharmacyStaff',
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/pharmacy/orders']}>
        <DashboardLayout><CurrentPath /></DashboardLayout>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(screen.getByText('No notifications yet.')).toBeInTheDocument();
  });
});
