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
  it('enables Admin directories and the approved Reports page', () => {
    useAuth.mockReturnValue({ role: 'Admin', isAuthenticated: true, user: { fullName: 'Admin' }, logout: vi.fn() });
    render(<MemoryRouter><DashboardLayout>Content</DashboardLayout></MemoryRouter>);
    for (const label of ['Doctors', 'Medicines', 'Appointments'])
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', `/admin/${label.toLowerCase()}`);
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/admin/reports');
  });
  it.each([null, 'Patient', 'Doctor', 'PharmacyStaff', 'Admin'])('includes About and Contact links for %s', (role) => {
    useAuth.mockReturnValue({ role, isAuthenticated: Boolean(role), user: { fullName: 'User' }, logout: vi.fn() });
    render(<MemoryRouter><DashboardLayout><p>Content</p></DashboardLayout></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '/contact');
    if (role === 'Admin') expect(screen.getByRole('link', { name: 'Manage Pharmacy Information' })).toHaveAttribute('href', '/admin/pharmacy-information');
    else expect(screen.queryByRole('link', { name: 'Manage Pharmacy Information' })).not.toBeInTheDocument();
  });
  it('uses the patient layout for visitors with login at the top right', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, role: null, user: null });
    render(<MemoryRouter><DashboardLayout><p>Home content</p></DashboardLayout></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Medicines' })).toHaveAttribute('href', '/patient/medicines');
    expect(screen.getByRole('link', { name: 'Doctors' })).toHaveAttribute('href', '/patient/doctors');
    expect(screen.getByRole('link', { name: 'Login' }).closest('header')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Logout/ })).not.toBeInTheDocument();
  });
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
