import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DoctorAppointmentsPage from './DoctorAppointmentsPage';
import DoctorAppointmentDetailsPage from './DoctorAppointmentDetailsPage';
const http = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'doctor-one', fullName: 'Doctor One' }, token: 'token-one', isAuthenticated: true }));
vi.mock('../api/appointmentApi', () => ({ appointmentApi: http }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
const row = (overrides = {}) => ({ id: 7, appointmentReference: 'CN-APT-007', patientId: 'patient-one', patientName: 'Nimal Silva', patientPhone: '0771234567', appointmentStartUtc: '2026-10-11T08:00:00Z', appointmentEndUtc: '2026-10-11T08:30:00Z', status: 'Booked', updatedAtUtc: null, paymentMethod: 'Cash', paymentStatus: 'Pending', isToday: true, isUpcoming: false, isCompleted: false, isHistory: false, allowedStatuses: ['Confirmed', 'Completed', 'NoShow'], contactsUnavailable: false, ...overrides });
const list = (appointments = [row()]) => ({ appointments, statistics: { today: 1, upcoming: 1, completed: 1, patientCount: 2 }, contactsUnavailable: false });
const App = () => <Routes><Route path="/doctor/appointments" element={<DoctorAppointmentsPage />} /><Route path="/doctor/appointments/:appointmentId" element={<><Link to="/doctor/appointments/8">Next appointment</Link><DoctorAppointmentDetailsPage /></>} /></Routes>;
const open = (path = '/doctor/appointments') => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
beforeEach(() => { vi.resetAllMocks(); auth.token = 'token-one'; auth.user = { id: 'doctor-one' }; auth.isAuthenticated = true; }); afterEach(cleanup);

it('shows assigned patient details and switches between schedule views', async () => {
  http.get.mockResolvedValue({ data: list([row(), row({ id: 8, appointmentReference: 'FUTURE', isToday: false, isUpcoming: true }), row({ id: 9, appointmentReference: 'PAST', status: 'Completed', isToday: false, isCompleted: true, allowedStatuses: [] }), row({ id: 10, appointmentReference: 'MISSED', status: 'NoShow', isToday: false, isHistory: true, allowedStatuses: [] })]) });
  const user = userEvent.setup(); open(); await screen.findByText('CN-APT-007');
  expect(screen.getByText('Nimal Silva')).toBeInTheDocument(); expect(screen.getByText('0771234567')).toBeInTheDocument(); expect(screen.getByText(/Sri Lanka/)).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: /Upcoming/ })); expect(screen.getByText('FUTURE')).toBeInTheDocument(); expect(screen.queryByText('CN-APT-007')).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: /Completed/ })); expect(screen.getByText('PAST')).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: /History/ })); expect(screen.getByText('No Show')).toBeInTheDocument();
});
it('shows empty schedules and retries load failures', async () => {
  http.get.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce({ data: list([]) });
  const user = userEvent.setup(); open(); await user.click(await screen.findByRole('button', { name: 'Retry' })); expect(await screen.findByText('No scheduled appointments')).toBeInTheDocument();
});
it('keeps appointment information available when contacts cannot load', async () => {
  http.get.mockResolvedValue({ data: { ...list([row({ patientName: null, patientPhone: null, contactsUnavailable: true })]), contactsUnavailable: true } }); open();
  expect(await screen.findByText(/patient contact information is unavailable/i)).toBeInTheDocument(); expect(screen.getByText('CN-APT-007')).toBeInTheDocument();
});
it('confirms status updates and refreshes the persisted appointment', async () => {
  http.get.mockResolvedValueOnce({ data: row() }).mockResolvedValueOnce({ data: row({ status: 'Completed', allowedStatuses: [] }) });
  http.patch.mockResolvedValue({ status: 200, data: { id: 7, status: 'Completed', updatedAtUtc: '2026-10-11T10:00:00Z' } });
  const user = userEvent.setup(); open('/doctor/appointments/7'); await user.click(await screen.findByRole('button', { name: 'Mark Completed' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Appointment marked Completed.');
  expect(screen.queryByRole('button', { name: 'Mark Completed' })).not.toBeInTheDocument(); expect(screen.getByText('Nimal Silva')).toBeInTheDocument();
});
it.each([{ response: { status: 409 } }, { response: { status: 503 } }])('preserves details on a rejected update %j', async failure => {
  http.get.mockResolvedValue({ data: row() }); http.patch.mockRejectedValue(failure);
  const user = userEvent.setup(); open('/doctor/appointments/7'); await user.click(await screen.findByRole('button', { name: 'Mark Completed' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(screen.getByText('Nimal Silva')).toBeInTheDocument(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it.each([{ status: 204 }, { status: 200, data: {} }])('does not show success for an invalid confirmation %j', async response => {
  http.get.mockResolvedValue({ data: row() }); http.patch.mockResolvedValue(response);
  const user = userEvent.setup(); open('/doctor/appointments/7'); await user.click(await screen.findByRole('button', { name: 'Mark Completed' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(screen.getByText('Nimal Silva')).toBeInTheDocument(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('hides data and actions after authorization is revoked', async () => {
  http.get.mockResolvedValueOnce({ data: row() }).mockRejectedValueOnce({ response: { status: 403 } });
  const user = userEvent.setup(); open('/doctor/appointments/7'); await screen.findByText('Nimal Silva'); await user.click(screen.getByRole('button', { name: 'Refresh status' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(screen.queryByText('Nimal Silva')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Mark Completed' })).not.toBeInTheDocument();
});
it('ignores a delayed response after navigating to another appointment', async () => {
  let resolve; http.get.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce({ data: row({ id: 8, appointmentReference: 'NEXT', patientName: 'Next Patient' }) });
  const user = userEvent.setup(); open('/doctor/appointments/7'); await user.click(screen.getByRole('link', { name: 'Next appointment' })); await screen.findByText('Next Patient');
  await act(async () => resolve({ data: row() })); expect(screen.queryByText('Nimal Silva')).not.toBeInTheDocument();
});

it('updates appointments under React StrictMode', async () => {
  http.get.mockResolvedValue({ data: row() }); http.patch.mockResolvedValue({ status: 200, data: { id: 7, status: 'Completed', updatedAtUtc: '2026-10-11T10:00:00Z' } });
  const user = userEvent.setup(); render(<React.StrictMode><MemoryRouter initialEntries={['/doctor/appointments/7']}><App /></MemoryRouter></React.StrictMode>);
  await user.click(await screen.findByRole('button', { name: 'Mark Completed' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Appointment marked Completed.');
});

it('ignores delayed patient information after the signed-in identity changes', async () => {
  let resolve; http.get.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce({ data: list([]) });
  const app = open(); auth.user = { id: 'doctor-two' }; auth.token = 'token-two';
  app.rerender(<MemoryRouter initialEntries={['/doctor/appointments']}><App /></MemoryRouter>);
  await screen.findByText('No scheduled appointments'); await act(async () => resolve({ data: list() }));
  expect(screen.queryByText('Nimal Silva')).not.toBeInTheDocument();
});

it('prevents duplicate status submissions while confirmation is pending', async () => {
  let resolve; http.get.mockResolvedValue({ data: row() }); http.patch.mockImplementation(() => new Promise(r => { resolve = r; }));
  const user = userEvent.setup(); open('/doctor/appointments/7');
  const button = await screen.findByRole('button', { name: 'Mark Completed' }); await user.dblClick(button);
  expect(http.patch).toHaveBeenCalledTimes(1); expect(button).toBeDisabled();
  await act(async () => resolve({ status: 200, data: { id: 7, status: 'Completed', updatedAtUtc: '2026-10-11T10:00:00Z' } }));
  expect(await screen.findByRole('status')).toHaveTextContent('Appointment marked Completed.');
});

it('ignores a delayed status confirmation after navigating away', async () => {
  let resolve; http.get.mockImplementation(async path => ({ data: row(path.endsWith('/8') ? { id: 8, appointmentReference: 'NEXT', patientName: 'Next Patient' } : {}) }));
  http.patch.mockImplementation(() => new Promise(r => { resolve = r; }));
  const user = userEvent.setup(); open('/doctor/appointments/7'); await user.click(await screen.findByRole('button', { name: 'Mark Completed' }));
  await user.click(screen.getByRole('link', { name: 'Next appointment' })); await screen.findByText('Next Patient');
  await act(async () => resolve({ status: 200, data: { id: 7, status: 'Completed', updatedAtUtc: '2026-10-11T10:00:00Z' } }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument(); expect(screen.getByText('Next Patient')).toBeInTheDocument();
});

it('keeps a confirmed status visible if the following refresh fails', async () => {
  http.get.mockResolvedValueOnce({ data: row() }).mockRejectedValueOnce({ response: { status: 503 } });
  http.patch.mockResolvedValue({ status: 200, data: { id: 7, status: 'Completed', updatedAtUtc: '2026-10-11T10:00:00Z' } });
  const user = userEvent.setup(); open('/doctor/appointments/7'); await user.click(await screen.findByRole('button', { name: 'Mark Completed' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Appointment marked Completed.'); expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
  expect(screen.getByText('Completed')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Mark Completed' })).not.toBeInTheDocument();
});
