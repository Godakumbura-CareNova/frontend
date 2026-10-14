import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import AppointmentPaymentTransactionsPage from './AppointmentPaymentTransactionsPage';
import AppointmentPaymentTransactionDetailPage from './AppointmentPaymentTransactionDetailPage';
const api = vi.hoisted(() => ({ listAppointmentPaymentTransactions: vi.fn(), getStaffAppointmentPaymentTransaction: vi.fn(), getPendingAppointmentReceipts: vi.fn(), getAppointmentReceiptFile: vi.fn(), verifyAppointmentReceipt: vi.fn() }));
vi.mock('../services/appointmentPaymentService', () => api);
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
const transaction = { id: 1, appointmentId: 7, reference: 'APT-007', doctorName: 'Dr Silva', patientId: 'patient-id', startUtc: '2026-10-15T05:50:00Z', appointmentStatus: 'Booked', method: 'PaymentGateway', amount: 2700, status: 'AwaitingGatewayPayment', category: 'Pending', updatedAtUtc: '2026-10-14T10:00:00Z' };
const result = { transactions: [transaction], counts: { all: 21, pending: 19, successful: 1, failed: 0, rejected: 1 }, totalCount: 21, page: 1, pageSize: 20, totalPages: 2 };
function Location() { return <output aria-label="Current location">{useLocation().search}</output>; }
function mount(path = '/pharmacy/appointment-payments') {
  return render(<MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/pharmacy/appointment-payments" element={<AppointmentPaymentTransactionsPage />} />
    <Route path="/pharmacy/appointment-payments/transactions/:paymentId" element={<AppointmentPaymentTransactionDetailPage />} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  vi.resetAllMocks();
  api.listAppointmentPaymentTransactions.mockResolvedValue(result);
  api.getPendingAppointmentReceipts.mockResolvedValue([]);
  api.getStaffAppointmentPaymentTransaction.mockResolvedValue({ transaction, receipts: [], onlineAttempts: [], reconciliations: [] });
});

it('shows appointment history and maps the existing gateway status to patient-friendly wording', async () => {
  mount();
  expect(await screen.findByText('APT-007')).toBeInTheDocument();
  expect(screen.getByText('Awaiting online payment')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
  expect(api.listAppointmentPaymentTransactions).toHaveBeenCalledWith({ status: 'All', method: '', search: '', page: 1, pageSize: 20 }, expect.any(AbortSignal));
});

it('uses server pagination, resets the page on filters, and clears a committed search', async () => {
  const user = userEvent.setup(); mount(); await screen.findByText('APT-007');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(api.listAppointmentPaymentTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal)));
  await user.selectOptions(screen.getByLabelText('Payment method'), 'Cash');
  await waitFor(() => expect(api.listAppointmentPaymentTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, method: 'Cash' }), expect.any(AbortSignal)));
  await user.type(screen.getByRole('textbox'), 'Dr Silva'); await user.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() => expect(api.listAppointmentPaymentTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Dr Silva' }), expect.any(AbortSignal)));
  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByRole('textbox')).toHaveFocus();
  await waitFor(() => expect(api.listAppointmentPaymentTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ search: '' }), expect.any(AbortSignal)));
  await user.click(screen.getByRole('button', { name: /^Rejected/ }));
  await waitFor(() => expect(api.listAppointmentPaymentTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Rejected' }), expect.any(AbortSignal)));
});

it('discards late responses after filters change', async () => {
  let resolveFirst;
  api.listAppointmentPaymentTransactions.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
  api.listAppointmentPaymentTransactions.mockResolvedValue({ ...result, transactions: [] });
  const user = userEvent.setup(); mount();
  await user.click(screen.getByRole('button', { name: /^Successful/ }));
  await screen.findByText('No appointment payments match these filters.');
  resolveFirst(result);
  await waitFor(() => expect(screen.queryByText('APT-007')).not.toBeInTheDocument());
});

it('supports load retry and shows permission errors without a retry action', async () => {
  api.listAppointmentPaymentTransactions.mockRejectedValueOnce(new Error('Offline'));
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: 'Retry' }));
  await screen.findByText('APT-007');
  api.listAppointmentPaymentTransactions.mockRejectedValueOnce({ response: { status: 403 } });
  await user.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('permission');
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
});

it('keeps the original receipt verification flow and reloads history on return', async () => {
  api.getPendingAppointmentReceipts.mockResolvedValue([{ id:12, appointmentId:7, appointmentReference:'APT-007', patientId:'patient-id', amount:2700, fileName:'receipt.pdf', status:'PendingVerification' }]);
  api.verifyAppointmentReceipt.mockImplementation(async () => { api.getPendingAppointmentReceipts.mockResolvedValue([]); });
  const user = userEvent.setup(); mount();
  await user.click(screen.getByRole('button', { name: 'Awaiting verification' }));
  await user.click(await screen.findByRole('button', { name: 'Approve' }));
  expect(api.verifyAppointmentReceipt).toHaveBeenCalledWith(7, true, null);
  await screen.findByText('No appointment receipts are waiting for verification.');
  await user.click(screen.getByRole('button', { name: 'Back to payment history' }));
  await screen.findByText('APT-007');
  expect(api.listAppointmentPaymentTransactions).toHaveBeenCalledTimes(2);
});

it('opens safe details and returns to the original list filters', async () => {
  const user = userEvent.setup(); mount('/pharmacy/appointment-payments?status=Pending&method=PaymentGateway');
  await user.click(await screen.findByRole('link', { name: 'View payment for APT-007' }));
  expect(await screen.findByRole('region', { name: 'Payment information' })).toHaveTextContent('Dr Silva');
  expect(screen.getByText('No receipts have been submitted.')).toBeInTheDocument();
  expect(screen.getByText('No online payment attempts recorded.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Mark as paid/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Back to payment history' }));
  expect(screen.getByLabelText('Current location')).toHaveTextContent('status=Pending&method=PaymentGateway');
});

it('shows existing receipt rejection reasons and online attempts without inventing a status audit log', async () => {
  api.getStaffAppointmentPaymentTransaction.mockResolvedValue({ transaction: { ...transaction, method:'BankTransfer', category:'Rejected', status:'AwaitingBankTransferReceipt' },
    receipts:[{id:12,fileName:'receipt.pdf',status:'Rejected',rejectionReason:'Amount mismatch',uploadedAtUtc:'2026-10-14T10:00:00Z'}],
    onlineAttempts:[{id:2,attemptNumber:1,amount:2700,status:'Failed',createdAtUtc:'2026-10-14T10:00:00Z',failureMessage:'Payment declined'}],reconciliations:[] });
  mount('/pharmacy/appointment-payments/transactions/1');
  expect(await screen.findByText('Receipt rejected')).toBeInTheDocument();
  expect(screen.getByText('Rejection reason: Amount mismatch')).toBeInTheDocument();
  expect(screen.getByText('Attempt 1 · Failed')).toBeInTheDocument();
});
