import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import DoctorDashboard from './DoctorDashboard';
const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api/appointmentApi', () => ({ appointmentApi: http }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'doctor', fullName: 'Test Doctor' }, token: 'token', isAuthenticated: true }) }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
afterEach(cleanup);
it('populates real dashboard totals and provides schedule entry points', async () => {
  http.get.mockResolvedValue({ data: { appointments: [], statistics: { today: 2, upcoming: 3, completed: 4, patientCount: 5 }, contactsUnavailable: false } });
  render(<MemoryRouter><DoctorDashboard /></MemoryRouter>);
  expect(await screen.findByText('5')).toBeInTheDocument(); expect(screen.getByText('2')).toBeInTheDocument(); expect(screen.getByText('3')).toBeInTheDocument(); expect(screen.getByText('4')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /view today's appointments/i })).toHaveAttribute('href', '/doctor/appointments?view=today');
  expect(screen.getByRole('link', { name: /Professional Profile/ })).toHaveAttribute('href', '/profile');
});
