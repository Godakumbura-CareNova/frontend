import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PatientAppointmentsPage from './PatientAppointmentsPage';
import PatientAppointmentDetailsPage from './PatientAppointmentDetailsPage';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api/appointmentApi', () => ({ appointmentApi: http }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
const appointment = (overrides = {}) => ({ id: 7, appointmentReference: 'CN-APT-007', doctorName: 'Dr Silva', appointmentStartUtc: '2026-10-12T08:00:00Z', appointmentEndUtc: '2026-10-12T08:30:00Z', status: 'Booked', section: 'Upcoming', paymentMethod: null, paymentStatus: null, canPay: true, ...overrides });
const renderPage = (path = '/patient/appointments') => render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/patient/appointments" element={<PatientAppointmentsPage />} />
  <Route path="/patient/appointments/:appointmentId" element={<><Link to="/patient/appointments/8">Next appointment</Link><PatientAppointmentDetailsPage /></>} />
  <Route path="/patient/appointments/:appointmentId/payment" element={<h1>Appointment payment</h1>} />
</Routes></MemoryRouter>);
beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);

it('shows upcoming and history with stored status and payment information', async () => {
  http.get.mockResolvedValue({ data: [appointment(), appointment({ id: 8, appointmentReference: 'CN-APT-008', section: 'Previous', status: 'Cancelled', paymentMethod: 'Cash', paymentStatus: 'Pending', canPay: false })] });
  renderPage();
  const upcoming = await screen.findByRole('region', { name: 'Upcoming appointments' });
  expect(within(upcoming).getByText('CN-APT-007')).toBeInTheDocument();
  expect(within(upcoming).getByText('Dr Silva')).toBeInTheDocument();
  expect(within(upcoming).getByText('Not selected')).toBeInTheDocument();
  expect(within(upcoming).getByText('Not paid')).toBeInTheDocument();
  const history = screen.getByRole('region', { name: 'Previous appointments' });
  expect(within(history).getByText('CN-APT-008')).toBeInTheDocument();
  expect(within(history).getByText('Cancelled')).toBeInTheDocument();
  expect(within(history).getByText('Cash')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /cancel appointment/i })).not.toBeInTheDocument();
});

it('shows an empty state without suggesting a loading failure', async () => {
  http.get.mockResolvedValue({ data: [] }); renderPage();
  expect(await screen.findByText('No appointments yet')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('allows retry after a failed list request', async () => {
  http.get.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce({ data: [appointment()] });
  const user = userEvent.setup(); renderPage();
  await user.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('CN-APT-007')).toBeInTheDocument();
});

it('opens full details and the existing payment route for an eligible appointment', async () => {
  http.get.mockImplementation(async path => ({ data: path === '/api/appointments' ? [appointment()] : appointment({ paymentMethod: 'BankTransfer', paymentStatus: 'AwaitingBankTransferReceipt' }) }));
  const user = userEvent.setup(); renderPage(); await user.click(await screen.findByRole('link', { name: 'View details for CN-APT-007' }));
  expect(await screen.findByRole('heading', { name: 'Appointment CN-APT-007' })).toBeInTheDocument();
  expect(screen.getByText('Dr Silva')).toBeInTheDocument();
  expect(screen.getByText('Bank transfer')).toBeInTheDocument();
  expect(screen.getByText('Awaiting bank transfer receipt')).toBeInTheDocument();
  expect(screen.getByText('Appointment date')).toBeInTheDocument(); expect(screen.getByText('Appointment time')).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Continue to Payment' }));
  expect(await screen.findByRole('heading', { name: 'Appointment payment' })).toBeInTheDocument();
});

it('does not offer payment on a closed appointment and refreshes payment status', async () => {
  http.get.mockResolvedValueOnce({ data: appointment({ section: 'Previous', status: 'Completed', paymentMethod: 'PaymentGateway', paymentStatus: 'Successful', canPay: false }) })
    .mockResolvedValueOnce({ data: appointment({ section: 'Previous', status: 'Cancelled', paymentMethod: 'PaymentGateway', paymentStatus: 'Successful', canPay: false }) });
  const user = userEvent.setup(); renderPage('/patient/appointments/7');
  expect(await screen.findByText('Completed')).toBeInTheDocument(); expect(screen.getByText('Successful')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Continue to Payment' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Refresh status' }));
  expect(await screen.findByText('Cancelled')).toBeInTheDocument();
});

it('handles another patients or missing appointment without showing appointment data', async () => {
  http.get.mockRejectedValue({ response: { status: 404 } }); renderPage('/patient/appointments/7');
  expect(await screen.findByRole('alert')).toHaveTextContent('Appointment not found.');
  expect(screen.queryByText('Dr Silva')).not.toBeInTheDocument();
});

it('keeps last loaded information visible with an error after a failed refresh', async () => {
  http.get.mockResolvedValueOnce({ data: appointment() }).mockRejectedValueOnce({ response: { status: 503 } });
  const user = userEvent.setup(); renderPage('/patient/appointments/7');
  await screen.findByText('Dr Silva'); await user.click(screen.getByRole('button', { name: 'Refresh status' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  expect(screen.getByText('Dr Silva')).toBeInTheDocument();
});

it('shows an unavailable section and hides payment when status is unknown', async () => {
  http.get.mockResolvedValue({ data: [appointment({ section: 'Unavailable', status: 'Unavailable', canPay: false, paymentStatus: 'Unavailable' })] }); renderPage();
  const section = await screen.findByRole('region', { name: 'Appointments needing an update' });
  expect(within(section).getByText('CN-APT-007')).toBeInTheDocument();
  expect(within(section).getByText(/status information is unavailable/i)).toBeInTheDocument();
});

it.each([undefined, '<html>Unexpected response</html>'])('rejects an empty or invalid successful API response', async data => {
  http.get.mockResolvedValue({ data }); renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  expect(screen.queryByText('No appointments yet')).not.toBeInTheDocument();
});

it('sorts upcoming appointments nearest first and history newest first', async () => {
  http.get.mockResolvedValue({ data: [
    appointment({ id: 8, appointmentReference: 'LATER', appointmentStartUtc: '2026-10-13T08:00:00Z' }), appointment(),
    appointment({ id: 9, appointmentReference: 'OLDER', section: 'Previous', appointmentStartUtc: '2026-10-09T08:00:00Z' }),
    appointment({ id: 10, appointmentReference: 'RECENT', section: 'Previous', appointmentStartUtc: '2026-10-10T08:00:00Z' }),
  ] }); renderPage();
  const upcoming = await screen.findByRole('region', { name: 'Upcoming appointments' });
  expect(within(upcoming).getAllByRole('link').map(link => link.textContent)).toEqual(['CN-APT-007', 'LATER']);
  const history = screen.getByRole('region', { name: 'Previous appointments' });
  expect(within(history).getAllByRole('link').map(link => link.textContent)).toEqual(['RECENT', 'OLDER']);
});

it('ignores a late response for the appointment that was left behind', async () => {
  let resolveOld;
  http.get.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ data: appointment({ id: 8, appointmentReference: 'CN-APT-008', doctorName: 'Dr Perera' }) });
  const user = userEvent.setup(); renderPage('/patient/appointments/7');
  await user.click(screen.getByRole('link', { name: 'Next appointment' }));
  expect(await screen.findByText('Dr Perera')).toBeInTheDocument();
  await act(async () => { resolveOld({ data: appointment() }); });
  expect(screen.getByText('Dr Perera')).toBeInTheDocument(); expect(screen.queryByText('Dr Silva')).not.toBeInTheDocument();
});
