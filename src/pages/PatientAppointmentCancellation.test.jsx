import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AppointmentCancellationPanel from '../components/appointments/AppointmentCancellationPanel';
import PatientAppointmentDetailsPage from './PatientAppointmentDetailsPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'patient1' }, token: 'token1', isAuthenticated: true }));
vi.mock('../api/appointmentApi', () => ({ appointmentApi: http }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
const eligibility = overrides => ({ appointmentId: 7, allowed: true, reasonCode: 'Unpaid', message: 'No refund is required.', refundOutcome: 'NotRequired', refundAmount: 0, requiresNoRefundAcknowledgement: false, version: 'a'.repeat(64), cancellation: null, ...overrides });
const result = { appointmentId: 7, appointmentReference: 'CN-7', status: 'Cancelled', cancelledAtUtc: '2026-10-11T10:00:00Z', refundOutcome: 'NotRequired', refundAmount: 0, refundStatus: null, reason: 'Plans changed', message: 'No refund is required.' };
beforeEach(() => { vi.resetAllMocks(); Object.assign(auth, { user: { id: 'patient1' }, token: 'token1', isAuthenticated: true }); http.get.mockResolvedValue({ status: 200, data: eligibility() }); });
afterEach(cleanup);
const setup = props => render(<AppointmentCancellationPanel appointmentId="7" appointmentReference="CN-7" appointmentStartUtc="2026-10-12T08:00:00Z" onCancelled={vi.fn()} {...props} />);
it('confirms cancellation and shows persisted outcome', async () => {
  http.post.mockResolvedValue({ status: 200, data: result }); const user = userEvent.setup(); setup();
  await user.click(await screen.findByRole('button', { name: 'Cancel appointment' }));
  await user.type(screen.getByLabelText('Reason (optional)'), 'Plans changed');
  await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Appointment cancelled');
  expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument();
});
it('requires acknowledgement for a paid bank transfer without refund', async () => {
  http.get.mockResolvedValue({ status: 200, data: eligibility({ refundOutcome: 'NotEligible', requiresNoRefundAcknowledgement: true, message: 'Less than 6 hours remain. No refund is available.' }) });
  const user = userEvent.setup(); setup(); await user.click(await screen.findByRole('button', { name: 'Cancel appointment' }));
  expect(screen.getByRole('button', { name: 'Confirm cancellation' })).toBeDisabled();
  await user.click(screen.getByRole('checkbox')); expect(screen.getByRole('button', { name: 'Confirm cancellation' })).toBeEnabled();
});
it('shows a restriction and does not offer cancellation', async () => {
  http.get.mockResolvedValue({ status: 200, data: eligibility({ allowed: false, message: 'Your receipt is being verified.' }) }); setup();
  expect(await screen.findByText('Your receipt is being verified.')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument();
});
it.each([204, 200])('preserves entered reason when submission is not confirmed (%s)', async status => {
  http.post.mockResolvedValue({ status, data: {} }); const user = userEvent.setup(); setup(); await user.click(await screen.findByRole('button', { name: 'Cancel appointment' }));
  await user.type(screen.getByLabelText('Reason (optional)'), 'Keep my reason'); await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/confirm/i); expect(screen.getByLabelText('Reason (optional)')).toHaveValue('Keep my reason'); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('ignores a late successful mutation after the session changes', async () => {
  let resolve; http.post.mockImplementation(() => new Promise(r => { resolve = r; })); const onCancelled = vi.fn(); const user = userEvent.setup(); const view = setup({ onCancelled });
  await user.click(await screen.findByRole('button', { name: 'Cancel appointment' })); await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  auth.token = 'token2'; auth.user = { id: 'patient2' }; view.rerender(<AppointmentCancellationPanel appointmentId="7" onCancelled={onCancelled} />);
  await act(async () => resolve({ status: 200, data: result })); expect(screen.queryByText('Appointment cancelled')).not.toBeInTheDocument(); expect(onCancelled).not.toHaveBeenCalled();
});
it('keeps Cancelled visible and hides new payment if appointment refresh fails after cancellation', async () => {
  let reads = 0;
  http.get.mockImplementation(async path => {
    if (path.endsWith('/cancellation')) return { status: 200, data: eligibility() };
    if (++reads > 1) throw new Error('offline');
    return { status: 200, data: { id: 7, appointmentReference: 'CN-7', doctorName: 'Dr Silva', appointmentStartUtc: '2026-10-12T08:00:00Z', appointmentEndUtc: '2026-10-12T09:00:00Z', status: 'Booked', section: 'Upcoming', paymentMethod: 'Cash', paymentStatus: 'Pending', canPay: true } };
  });
  http.post.mockResolvedValue({ status: 200, data: result }); const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/patient/appointments/7']}><Routes><Route path="/patient/appointments/:appointmentId" element={<PatientAppointmentDetailsPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'Continue to Payment' })).toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: 'Cancel appointment' })); await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Appointment cancelled');
  expect(await screen.findByText('Cancelled')).toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Continue to Payment' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View payment' })).toHaveAttribute('href', '/patient/appointments/7/payment');
});
it('shows stored manual refund information after reload', async () => {
  http.get.mockResolvedValue({ status: 200, data: eligibility({ allowed: false, cancellation: { ...result, refundOutcome: 'Eligible', refundAmount: 1500, refundStatus: 'PendingManualProcessing', message: 'Eligible for a refund, awaiting manual processing.' } }) });
  setup(); expect(await screen.findByRole('status')).toHaveTextContent('Appointment cancelled');
  expect(screen.getByText(/1,500.00/)).toBeInTheDocument(); expect(screen.getByText(/Awaiting manual processing by pharmacy staff/)).toBeInTheDocument();
});
it('blocks duplicate confirmation while pending', async () => {
  let resolve; http.post.mockImplementation(() => new Promise(r => { resolve = r; })); const user = userEvent.setup(); setup();
  await user.click(await screen.findByRole('button', { name: 'Cancel appointment' })); await user.dblClick(screen.getByRole('button', { name: 'Confirm cancellation' }));
  expect(screen.getByRole('button', { name: 'Cancelling...' })).toBeDisabled();
  await act(async () => resolve({ status: 200, data: result })); expect(await screen.findByRole('status')).toBeInTheDocument(); expect(http.post).toHaveBeenCalledTimes(1);
});
it('requires refresh and a fresh confirmation after a conflict', async () => {
  http.post.mockRejectedValueOnce({ response: { status: 409 } }).mockResolvedValueOnce({ status: 200, data: result }); const user = userEvent.setup(); setup();
  await user.click(await screen.findByRole('button', { name: 'Cancel appointment' })); await user.type(screen.getByLabelText('Reason (optional)'), 'Retain this');
  await user.click(screen.getByRole('button', { name: 'Confirm cancellation' })); expect(await screen.findByRole('alert')).toHaveTextContent(/changed/i);
  expect(screen.getByRole('button', { name: 'Confirm cancellation' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Refresh cancellation information' })); await user.click(await screen.findByRole('button', { name: 'Cancel appointment' }));
  expect(screen.getByLabelText('Reason (optional)')).toHaveValue('Retain this'); await user.click(screen.getByRole('button', { name: 'Confirm cancellation' })); expect(await screen.findByRole('status')).toBeInTheDocument();
});
it('supports Escape to keep the appointment and restore focus', async () => {
  const user = userEvent.setup(); setup(); const button = await screen.findByRole('button', { name: 'Cancel appointment' }); await user.click(button);
  expect(screen.getByLabelText('Reason (optional)')).toHaveFocus(); await user.keyboard('{Escape}'); expect(screen.queryByRole('button', { name: 'Confirm cancellation' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel appointment' })).toHaveFocus();
});
it('does not apply an old mutation when navigating away and back to the same scope', async () => {
  let resolve; http.post.mockImplementation(() => new Promise(r => { resolve = r; })); const onCancelled = vi.fn(); const user = userEvent.setup(); const view = setup({ onCancelled });
  await user.click(await screen.findByRole('button', { name: 'Cancel appointment' })); await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  view.rerender(<AppointmentCancellationPanel appointmentId="8" onCancelled={onCancelled} />);
  view.rerender(<AppointmentCancellationPanel appointmentId="7" onCancelled={onCancelled} />);
  await act(async () => resolve({ status: 200, data: result })); expect(onCancelled).not.toHaveBeenCalled(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
