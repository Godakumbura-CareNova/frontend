import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PatientAppointmentPaymentPage from './PatientAppointmentPaymentPage';

const api = vi.hoisted(() => ({
  getAppointmentPayment: vi.fn(), selectAppointmentPaymentMethod: vi.fn(), uploadAppointmentReceipt: vi.fn(),
  startAppointmentOnlinePayment: vi.fn(), getAppointmentOnlinePaymentResult: vi.fn(), cancelAppointmentOnlinePayment: vi.fn(),
}));
const sdk = vi.hoisted(() => ({ startPayment: vi.fn(), onCompleted: null, onDismissed: null, onError: null }));
const appointments = vi.hoisted(() => ({ getPatientAppointment: vi.fn() }));
vi.mock('../services/appointmentService', () => appointments);
vi.mock('../services/appointmentPaymentService', () => api);
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../utils/onlinePayment', async importOriginal => ({ ...await importOriginal(), loadPayHere: async () => sdk }));

const payment = (method = 'Cash', status = 'Pending') => ({ id: 11, appointmentId: 7, appointmentReference: 'CN-APT-TEST', amount: 2700, method, status, updatedAtUtc: '2026-10-11T08:00:00Z' });
const session = { attemptId: 12, attemptNumber: 1, sandbox: true, merchantId: 'TEST123', gatewayOrderId: 'CN-APT-TEST-1', items: 'Appointment', amount: '2700.00', currency: 'LKR', hash: 'TEST-HASH', notifyUrl: 'https://example.test/notify', returnUrl: 'http://localhost:3000/patient/appointments/7/payment', cancelUrl: 'http://localhost:3000/patient/appointments/7/payment', firstName: 'Test', lastName: 'Patient', email: 'patient@example.test', phone: '0771234567', address: 'Test address', city: 'Colombo', country: 'Sri Lanka', custom1: '11', appointmentReference: 'CN-APT-TEST' };
const renderPage = () => render(<MemoryRouter initialEntries={['/patient/appointments/7/payment']}><Routes><Route path="/patient/appointments/:appointmentId/payment" element={<PatientAppointmentPaymentPage />} /></Routes></MemoryRouter>);
const fillBilling = async user => {
  for (const [label, value] of [['First name', 'Test'], ['Last name', 'Patient'], ['Email', 'patient@example.test'], ['Phone', '0771234567'], ['Address', 'Test address'], ['City', 'Colombo']]) await user.type(screen.getByLabelText(label), value);
};
beforeEach(() => {
  vi.resetAllMocks(); api.getAppointmentPayment.mockResolvedValue(payment());
  appointments.getPatientAppointment.mockResolvedValue({ id: 7, status: 'Booked' });
  api.startAppointmentOnlinePayment.mockResolvedValue(session);
  sdk.onCompleted = sdk.onDismissed = sdk.onError = null;
});

it.each([['Cash', 'Pending'], ['BankTransfer', 'AwaitingBankTransferReceipt'], ['PaymentGateway', 'Failed']])('shows cancelled %s payment history without payment controls', async (method, status) => {
  appointments.getPatientAppointment.mockResolvedValue({ id: 7, status: 'Cancelled' }); api.getAppointmentPayment.mockResolvedValue(payment(method, status));
  renderPage(); expect(await screen.findByRole('heading', { name: 'Payment history' })).toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Pay LKR|upload receipt|try again/i })).not.toBeInTheDocument(); expect(screen.getByText('CN-APT-TEST')).toBeInTheDocument();
});
it('does not offer payment if appointment status cannot be loaded', async () => {
  appointments.getPatientAppointment.mockRejectedValue(new Error('offline')); renderPage();
  expect(await screen.findByText('Could not load appointment payment.')).toBeInTheDocument(); expect(screen.queryByRole('radio')).not.toBeInTheDocument();
});
afterEach(cleanup);

it('shows the rejection reason and allows a corrected receipt, clearing old feedback after upload', async () => {
  api.getAppointmentPayment.mockResolvedValue({ ...payment('BankTransfer', 'AwaitingBankTransferReceipt'), latestReceipt: { status:'Rejected', rejectionReason:'Incorrect amount', reviewedAtUtc:'2026-10-15T07:00:00Z' } });
  api.uploadAppointmentReceipt.mockImplementation(async () => { api.getAppointmentPayment.mockResolvedValue({ ...payment('BankTransfer', 'ReceiptUnderVerification'), latestReceipt: { status:'PendingVerification', rejectionReason:null } }); });
  const user = userEvent.setup(); renderPage();
  expect(await screen.findByRole('heading', { name:'Receipt rejected' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Incorrect amount');
  await user.upload(screen.getByLabelText('Choose receipt'), new File(['%PDF-1.4 test'], 'corrected.pdf', {type:'application/pdf'}));
  await user.click(screen.getByRole('button', { name:'Upload another receipt' }));
  expect(api.uploadAppointmentReceipt).toHaveBeenCalledWith('7', expect.any(File));
  expect(await screen.findByRole('heading', { name:'Receipt under verification' })).toBeInTheDocument();
  expect(screen.queryByText(/Incorrect amount/)).not.toBeInTheDocument();
});

it('selects cash for the routed appointment and shows the saved unpaid status', async () => {
  api.getAppointmentPayment.mockRejectedValue({ response: { status: 404 } });
  api.selectAppointmentPaymentMethod.mockResolvedValue(payment()); const user = userEvent.setup(); renderPage();
  await user.click(await screen.findByRole('radio', { name: /cash/i })); await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('heading', { name: 'Cash selected' })).toBeInTheDocument();
  expect(api.selectAppointmentPaymentMethod).toHaveBeenCalledWith('7', 'Cash');
  expect(screen.getByText('Pending')).toBeInTheDocument(); expect(screen.queryByText('Payment successful')).not.toBeInTheDocument();
});

it('preserves the selected method when saving fails and allows retry', async () => {
  api.selectAppointmentPaymentMethod.mockRejectedValueOnce({ response: { status: 503, data: { message: 'Payment service unavailable' } } }).mockResolvedValueOnce(payment('BankTransfer', 'AwaitingBankTransferReceipt'));
  const user = userEvent.setup(); renderPage(); await user.click(await screen.findByRole('radio', { name: /bank transfer/i }));
  await user.click(screen.getByRole('button', { name: 'Continue' })); expect(await screen.findByText('Payment service unavailable')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /bank transfer/i })).toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Continue' })); expect(await screen.findByRole('button', { name: 'Upload receipt' })).toBeInTheDocument();
});

it('requires a receipt and retains the selected file after an upload failure', async () => {
  api.getAppointmentPayment.mockResolvedValue(payment('BankTransfer', 'AwaitingBankTransferReceipt'));
  api.uploadAppointmentReceipt.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Invalid receipt content' } } }).mockImplementationOnce(async () => { api.getAppointmentPayment.mockResolvedValue(payment('BankTransfer', 'ReceiptUnderVerification')); });
  const user = userEvent.setup(); renderPage(); await user.click(await screen.findByRole('button', { name: 'Upload receipt' }));
  expect(screen.getByText('Choose a receipt first.')).toBeInTheDocument(); expect(api.uploadAppointmentReceipt).not.toHaveBeenCalled();
  const file = new File(['%PDF-1.4 test'], 'receipt.pdf', { type: 'application/pdf' }); await user.upload(screen.getByLabelText('Choose receipt'), file);
  await user.click(screen.getByRole('button', { name: 'Upload receipt' })); expect(await screen.findByText('Invalid receipt content')).toBeInTheDocument();
  expect(screen.getByText('receipt.pdf')).toBeInTheDocument(); expect(screen.queryByText('Payment successful')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Upload receipt' })); expect(await screen.findByRole('heading', { name: 'Receipt under verification' })).toBeInTheDocument();
  expect(api.uploadAppointmentReceipt).toHaveBeenLastCalledWith('7', file);
});

it('blocks incomplete billing before opening the gateway', async () => {
  api.getAppointmentPayment.mockResolvedValue(payment('PaymentGateway', 'AwaitingGatewayPayment'));
  const user = userEvent.setup(); renderPage(); await user.click(await screen.findByRole('button', { name: 'Pay LKR 2700.00' }));
  expect(screen.getByText('Enter your first name.')).toBeInTheDocument(); expect(api.startAppointmentOnlinePayment).not.toHaveBeenCalled();
});

it('preserves billing when the gateway is unavailable and allows retry', async () => {
  api.getAppointmentPayment.mockResolvedValue(payment('PaymentGateway', 'AwaitingGatewayPayment'));
  api.startAppointmentOnlinePayment.mockRejectedValueOnce({ response: { status: 503, data: { message: 'Gateway unavailable' } } }).mockResolvedValueOnce(session);
  const user = userEvent.setup(); renderPage(); await screen.findByRole('button', { name: 'Pay LKR 2700.00' }); await fillBilling(user);
  await user.click(screen.getByRole('button', { name: 'Pay LKR 2700.00' })); expect(await screen.findByText('Gateway unavailable')).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toHaveValue('patient@example.test');
  await user.click(screen.getByRole('button', { name: 'Pay LKR 2700.00' })); await waitFor(() => expect(sdk.startPayment).toHaveBeenCalledOnce());
  expect(sdk.startPayment).toHaveBeenCalledWith(expect.objectContaining({ order_id: 'CN-APT-TEST-1', amount: '2700.00', sandbox: true }));
});

it('does not treat the browser completion callback as payment confirmation', async () => {
  api.getAppointmentPayment.mockResolvedValue(payment('PaymentGateway', 'AwaitingGatewayPayment'));
  api.getAppointmentOnlinePaymentResult.mockResolvedValue({ outcome: 'Failed', message: 'Gateway verification failed', canRetry: true, isTest: true, transactionReference: 'CN-APT-TEST-1', failureCode: 'verification_failed', payment: payment('PaymentGateway', 'Failed') });
  const user = userEvent.setup(); renderPage(); await screen.findByRole('button', { name: 'Pay LKR 2700.00' }); await fillBilling(user);
  await user.click(screen.getByRole('button', { name: 'Pay LKR 2700.00' })); await waitFor(() => expect(sdk.startPayment).toHaveBeenCalledOnce());
  await act(async () => { await sdk.onCompleted(); });
  expect(await screen.findByRole('heading', { name: 'Failed' })).toBeInTheDocument(); expect(screen.queryByText('Payment successful')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Try again' })); expect(screen.getByLabelText('Email')).toHaveValue('patient@example.test');
});

it('prevents a second checkout while waiting for server confirmation', async () => {
  api.getAppointmentPayment.mockResolvedValue(payment('PaymentGateway', 'AwaitingGatewayPayment'));
  let resolveResult; api.getAppointmentOnlinePaymentResult.mockReturnValue(new Promise(resolve => { resolveResult = resolve; }));
  const user = userEvent.setup(); renderPage(); await screen.findByRole('button', { name: 'Pay LKR 2700.00' }); await fillBilling(user);
  await user.click(screen.getByRole('button', { name: 'Pay LKR 2700.00' })); await waitFor(() => expect(sdk.startPayment).toHaveBeenCalledOnce());
  let confirming; await act(async () => { confirming = sdk.onCompleted(); });
  try { expect(screen.getByLabelText('Email')).toBeDisabled(); expect(api.startAppointmentOnlinePayment).toHaveBeenCalledOnce(); }
  finally { await act(async () => { resolveResult({ outcome: 'Failed', message: 'Failed', canRetry: true, payment: payment('PaymentGateway', 'Failed') }); await confirming; }); }
});

it('shows success only after the server confirms the payment', async () => {
  api.getAppointmentPayment.mockResolvedValueOnce(payment('PaymentGateway', 'AwaitingGatewayPayment')).mockResolvedValueOnce(payment('PaymentGateway', 'Successful'));
  api.getAppointmentOnlinePaymentResult.mockResolvedValue({ outcome: 'Succeeded', message: 'Payment confirmed', canRetry: false, payment: payment('PaymentGateway', 'Successful') });
  const user = userEvent.setup(); renderPage(); await screen.findByRole('button', { name: 'Pay LKR 2700.00' }); await fillBilling(user);
  await user.click(screen.getByRole('button', { name: 'Pay LKR 2700.00' })); await waitFor(() => expect(sdk.startPayment).toHaveBeenCalledOnce());
  expect(screen.queryByRole('heading', { name: 'Payment successful' })).not.toBeInTheDocument();
  await act(async () => { await sdk.onCompleted(); });
  expect(await screen.findByRole('heading', { name: 'Payment successful' })).toBeInTheDocument();
  expect(api.getAppointmentOnlinePaymentResult).toHaveBeenCalledWith('7', 12);
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
});

it('retains the failed result and billing while refreshing payment status', async () => {
  api.getAppointmentPayment.mockResolvedValueOnce(payment('PaymentGateway', 'AwaitingGatewayPayment'));
  let resolveRefresh; api.getAppointmentPayment.mockReturnValueOnce(new Promise(resolve => { resolveRefresh = resolve; }));
  api.getAppointmentOnlinePaymentResult.mockResolvedValue({ outcome: 'Failed', message: 'Payment declined', canRetry: true, payment: payment('PaymentGateway', 'Failed') });
  const user = userEvent.setup(); renderPage(); await screen.findByRole('button', { name: 'Pay LKR 2700.00' }); await fillBilling(user);
  await user.click(screen.getByRole('button', { name: 'Pay LKR 2700.00' })); await waitFor(() => expect(sdk.startPayment).toHaveBeenCalledOnce());
  let confirming; await act(async () => { confirming = sdk.onCompleted(); });
  try { expect(screen.getByRole('heading', { name: 'Failed' })).toBeInTheDocument(); }
  finally { await act(async () => { resolveRefresh(payment('PaymentGateway', 'Failed')); await confirming; }); }
  await user.click(screen.getByRole('button', { name: 'Try again' })); expect(screen.getByLabelText('Email')).toHaveValue('patient@example.test');
});
