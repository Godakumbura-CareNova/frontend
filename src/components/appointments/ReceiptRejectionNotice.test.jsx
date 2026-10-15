import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import ReceiptRejectionNotice from './ReceiptRejectionNotice';
import { AppointmentInformation } from '../../pages/appointmentPresentation';
const rejected = { method:'BankTransfer',status:'AwaitingBankTransferReceipt',latestReceipt:{status:'Rejected',rejectionReason:'Amount does not match',reviewedAtUtc:'2026-10-15T07:00:00Z'} };
it('shows the reason and re-upload link, and replaces outdated rejection feedback on re-upload', () => {
  const {rerender}=render(<MemoryRouter><ReceiptRejectionNotice payment={rejected} reuploadTo="/patient/appointments/7/payment" /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('Amount does not match');
  expect(screen.getByRole('link',{name:/Upload another receipt/})).toHaveAttribute('href','/patient/appointments/7/payment');
  rerender(<MemoryRouter><ReceiptRejectionNotice payment={{...rejected,status:'ReceiptUnderVerification',latestReceipt:{status:'PendingVerification'}}} /></MemoryRouter>);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('does not display a historical rejected receipt as a current failure after payment succeeds or method changes', () => {
  const {rerender}=render(<MemoryRouter><ReceiptRejectionNotice payment={{...rejected,status:'Successful'}} /></MemoryRouter>);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  rerender(<MemoryRouter><ReceiptRejectionNotice payment={{...rejected,method:'Cash'}} /></MemoryRouter>);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('labels appointment payment status as receipt rejected without changing the appointment status', () => {
  render(<AppointmentInformation appointment={{paymentMethod:rejected.method,paymentStatus:rejected.status,status:'Booked',latestReceipt:rejected.latestReceipt}} />);
  expect(screen.getByText('Receipt rejected')).toBeInTheDocument();
  expect(screen.queryByText('Awaiting bank transfer receipt')).not.toBeInTheDocument();
});
