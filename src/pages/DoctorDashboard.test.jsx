import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DoctorDashboard from './DoctorDashboard';
const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api/appointmentApi', () => ({ appointmentApi: http }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'doctor', fullName: 'Test Doctor' }, token: 'token', isAuthenticated: true }) }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
const appointment = (id, group) => ({
  id, appointmentReference: `APT-${id}`, patientName: `Patient ${id}`, patientPhone: '0771234567',
  appointmentStartUtc: `2026-10-${String(12 + id).padStart(2, '0')}T05:00:00Z`,
  appointmentEndUtc: `2026-10-${String(12 + id).padStart(2, '0')}T05:30:00Z`,
  status: group === 'completed' ? 'Completed' : 'Confirmed', paymentMethod: 'Cash', paymentStatus: 'Successful',
  isToday: group === 'today', isUpcoming: group === 'upcoming', isCompleted: group === 'completed', isHistory: false, allowedStatuses: [],
});
const response = appointments => ({ data: { appointments, statistics: { today: 1, upcoming: 6, completed: 6, patientCount: 8 }, contactsUnavailable: false } });

it('shows bounded previews with details and clickable schedule summaries', async () => {
  http.get.mockResolvedValue(response([appointment(1, 'today'),
    ...Array.from({ length: 6 }, (_, i) => appointment(i + 2, 'upcoming')),
    ...Array.from({ length: 6 }, (_, i) => appointment(i + 8, 'completed'))]));
  render(<MemoryRouter><DoctorDashboard /></MemoryRouter>);
  const upcoming = await screen.findByRole('region', { name: 'Upcoming appointments' });
  const completed = screen.getByRole('region', { name: 'Completed appointments' });
  expect(within(upcoming).getAllByRole('article')).toHaveLength(5);
  expect(within(upcoming).queryByText('APT-7')).not.toBeInTheDocument();
  expect(within(upcoming).getByText('Patient 2')).toBeInTheDocument();
  expect(within(upcoming).getAllByText('0771234567')).toHaveLength(5);
  expect(within(upcoming).getAllByText('Successful')).toHaveLength(5);
  expect(within(upcoming).getAllByText('Appointment date')).toHaveLength(5);
  expect(within(upcoming).getAllByText('Appointment time')).toHaveLength(5);
  expect(within(completed).getAllByRole('article')).toHaveLength(5);
  expect(within(completed).getAllByRole('link', { name: /^View details/ })[0]).toHaveAttribute('href', '/doctor/appointments/13');
  expect(within(completed).queryByText('APT-8')).not.toBeInTheDocument();
  for (const [title, view] of [["Today's Appointments", 'today'], ['Upcoming Appointments', 'upcoming'], ['Completed Appointments', 'completed']]) {
    expect(screen.getByRole('link', { name: new RegExp(`^${title}`) })).toHaveAttribute('href', `/doctor/appointments?view=${view}`);
  }
  expect(screen.getByRole('link', { name: /^Patient Count/ })).toHaveAttribute('href', '/doctor/appointments');
});

it('shows separate empty states for each appointment section', async () => {
  http.get.mockResolvedValue(response([]));
  render(<MemoryRouter><DoctorDashboard /></MemoryRouter>);
  expect(await screen.findByText('No scheduled appointments today.')).toBeInTheDocument();
  expect(screen.getByText('No upcoming appointments.')).toBeInTheDocument();
  expect(screen.getByText('No completed appointments yet.')).toBeInTheDocument();
});

it('hides the contact warning while retaining missing-contact labels and appointment links', async () => {
  http.get.mockResolvedValue({ data: { ...response([{ ...appointment(2, 'upcoming'), patientName: null, patientPhone: null }]).data, contactsUnavailable: true } });
  render(<MemoryRouter><DoctorDashboard /></MemoryRouter>);
  expect(await screen.findByText('Patient name unavailable')).toBeInTheDocument();
  expect(screen.getByText('Phone number unavailable')).toBeInTheDocument();
  expect(screen.queryByText(/Some patient contact information is unavailable/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View details for APT-2' })).toHaveAttribute('href', '/doctor/appointments/2');
});

it('retries a failed dashboard load without displaying empty appointment states as results', async () => {
  http.get.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(response([appointment(2, 'upcoming')]));
  render(<MemoryRouter><DoctorDashboard /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load appointment information');
  expect(screen.queryByText('No upcoming appointments.')).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('link', { name: 'View details for APT-2' })).toBeInTheDocument();
});

it('refreshes previews and counts after appointment status changes', async () => {
  http.get.mockResolvedValueOnce(response([appointment(2, 'upcoming')])).mockResolvedValueOnce({ data: {
    ...response([appointment(2, 'completed')]).data, statistics: { today: 0, upcoming: 0, completed: 1, patientCount: 1 },
  } });
  render(<MemoryRouter><DoctorDashboard /></MemoryRouter>);
  await screen.findByRole('link', { name: 'View details for APT-2' });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh appointments' }));
  const completed = await screen.findByRole('region', { name: 'Completed appointments' });
  expect(await within(completed).findByRole('link', { name: 'View details for APT-2' })).toBeInTheDocument();
  expect(screen.getByText('No upcoming appointments.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^Upcoming Appointments/ })).toHaveTextContent('0');
});
it('populates real dashboard totals and provides schedule entry points', async () => {
  http.get.mockResolvedValue({ data: { appointments: [], statistics: { today: 2, upcoming: 3, completed: 4, patientCount: 5 }, contactsUnavailable: false } });
  render(<MemoryRouter><DoctorDashboard /></MemoryRouter>);
  expect(await screen.findByText('5')).toBeInTheDocument(); expect(screen.getByText('2')).toBeInTheDocument(); expect(screen.getByText('3')).toBeInTheDocument(); expect(screen.getByText('4')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /view today's appointments/i })).toHaveAttribute('href', '/doctor/appointments?view=today');
  expect(screen.getByRole('link', { name: /Professional Profile/ })).toHaveAttribute('href', '/profile');
});
