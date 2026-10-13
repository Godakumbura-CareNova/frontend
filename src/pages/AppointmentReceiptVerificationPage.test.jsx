import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AppointmentReceiptVerificationPage from './AppointmentReceiptVerificationPage';
const api = vi.hoisted(() => ({ getPendingAppointmentReceipts: vi.fn(), getAppointmentReceiptFile: vi.fn(), verifyAppointmentReceipt: vi.fn() }));
vi.mock('../services/appointmentPaymentService', () => api);
const receipt = { id: 12, appointmentId: 7, appointmentReference: 'CN-APT-TEST', patientId: '11111111-1111-1111-1111-111111111111', amount: 2700, fileName: 'receipt.pdf', contentType: 'application/pdf', sizeBytes: 100, status: 'PendingVerification', uploadedAtUtc: '2026-10-11T08:00:00Z' };
beforeEach(() => { vi.resetAllMocks(); api.getPendingAppointmentReceipts.mockResolvedValue([receipt]); });
afterEach(cleanup);
it('approves the correct appointment and removes the reviewed receipt after refresh', async () => {
  api.verifyAppointmentReceipt.mockImplementation(async () => { api.getPendingAppointmentReceipts.mockResolvedValue([]); });
  const user = userEvent.setup(); render(<AppointmentReceiptVerificationPage />); await user.click(await screen.findByRole('button', { name: 'Approve' }));
  expect(api.verifyAppointmentReceipt).toHaveBeenCalledWith(7, true, null);
  expect(await screen.findByText(/was approved/)).toBeInTheDocument(); expect(screen.getByText(/No appointment receipts/)).toBeInTheDocument();
});
it('requires a rejection reason and preserves it when verification fails', async () => {
  api.verifyAppointmentReceipt.mockRejectedValueOnce({ response: { data: { message: 'Verification unavailable' } } }).mockImplementationOnce(async () => { api.getPendingAppointmentReceipts.mockResolvedValue([]); });
  const user = userEvent.setup(); render(<AppointmentReceiptVerificationPage />); await user.click(await screen.findByRole('button', { name: 'Reject Receipt' }));
  expect(api.verifyAppointmentReceipt).not.toHaveBeenCalled(); expect(screen.getByText(/Please enter a rejection reason/)).toBeInTheDocument();
  await user.type(screen.getByLabelText('Rejection reason'), 'Amount does not match'); await user.click(screen.getByRole('button', { name: 'Reject Receipt' }));
  expect(await screen.findByText('Verification unavailable')).toBeInTheDocument(); expect(screen.getByLabelText('Rejection reason')).toHaveValue('Amount does not match');
  await user.click(screen.getByRole('button', { name: 'Reject Receipt' })); expect(await screen.findByText(/was rejected/)).toBeInTheDocument();
  expect(api.verifyAppointmentReceipt).toHaveBeenLastCalledWith(7, false, 'Amount does not match');
});
it('allows retry when pending receipts cannot load', async () => {
  api.getPendingAppointmentReceipts.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([receipt]);
  const user = userEvent.setup(); render(<AppointmentReceiptVerificationPage />); expect(await screen.findByText(/Failed to load pending/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Refresh' })); expect(await screen.findByRole('heading', { name: 'CN-APT-TEST' })).toBeInTheDocument();
});
