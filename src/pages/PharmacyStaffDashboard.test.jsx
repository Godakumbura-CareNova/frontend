import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import PharmacyStaffDashboard from './PharmacyStaffDashboard';
import * as service from '../services/roleDashboardService';
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'staff', role: 'PharmacyStaff', fullName: 'Staff Member' }, token: 'staff' }) }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/roleDashboardService', () => ({ getPatientOrderDashboard: vi.fn(), getPatientMedicinePaymentDashboard: vi.fn(), getPatientAppointmentDashboard: vi.fn(), getStaffOperationsDashboard: vi.fn(), getStaffMedicinePaymentDashboard: vi.fn(), getStaffAppointmentPaymentDashboard: vi.fn() }));
const time = '2026-10-11T10:00:00Z';
it('provides direct shortcuts for every staff summary card', async () => {
  render(<MemoryRouter><PharmacyStaffDashboard /></MemoryRouter>);
  for (const [name, destination] of [
    ['New Medicine Orders', '/pharmacy/orders?status=Pending'],
    ['Awaiting Prescription Verification', '/pharmacy/prescriptions'],
    ['Medicine Bank Transfers Awaiting Verification', '/pharmacy/payments'],
    ['Appointment Bank Transfers Awaiting Verification', '/pharmacy/appointment-payments?view=verification'],
    ['Low-Stock Medicines', '/pharmacy/inventory?lowStockOnly=true'],
    ['Ready for Collection', '/pharmacy/orders?status=ReadyForCollection'],
  ]) expect(screen.getByRole('link', { name: new RegExp(`^${name}`) })).toHaveAttribute('href', destination);
  await screen.findByText('Panadol');
});
const queue = { totalCount: 0, items: [] };
const payments = amount => ({ pendingTransfers: queue, recentPayments: [], income: { todayAmount: amount, monthAmount: amount, undatedSuccessfulCount: 0, undatedSuccessfulAmount: 0, currency: 'LKR', timeZone: 'Asia/Colombo', asOfUtc: time }, generatedAtUtc: time });
beforeEach(() => {
  vi.resetAllMocks();
  service.getStaffOperationsDashboard.mockResolvedValue({ newOrders: queue, pendingPrescriptions: queue, readyForCollection: queue, lowStock: { totalCount: 1, items: [{ medicineId: 1, medicineName: 'Panadol', quantity: 0, threshold: 10 }] }, generatedAtUtc: time });
  service.getStaffMedicinePaymentDashboard.mockResolvedValue(payments(100));
  service.getStaffAppointmentPaymentDashboard.mockResolvedValue(payments(200));
});
it('shows real queues and separates medicine from appointment income', async () => {
  render(<MemoryRouter><PharmacyStaffDashboard /></MemoryRouter>);
  expect(await screen.findByText('Panadol')).toBeInTheDocument();
  expect(screen.getByText(/Out of stock/)).toBeInTheDocument();
  const medicines = screen.getByRole('region', { name: 'Medicine payments and income' });
  const appointments = screen.getByRole('region', { name: 'Appointment payments and income' });
  const transfers = screen.getByRole('region', { name: 'Bank transfers awaiting verification' });
  expect(within(transfers).getAllByRole('link', { name: /View all/ })[1]).toHaveAttribute('href', '/pharmacy/appointment-payments?view=verification');
  expect(within(medicines).getAllByText(/100\.00/).length).toBe(2);
  expect(within(appointments).getAllByText(/200\.00/).length).toBe(2);
});
it('reports missing payment information without turning its amounts into zero', async () => {
  service.getStaffMedicinePaymentDashboard.mockRejectedValue(new Error());
  render(<MemoryRouter><PharmacyStaffDashboard /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: /Retry medicine payments and income/i })).toBeInTheDocument();
  const medicines = screen.getByRole('region', { name: 'Medicine payments and income' });
  expect(within(medicines).queryByText(/LKR/)).not.toBeInTheDocument();
  expect(await screen.findByText('Panadol')).toBeInTheDocument();
});
it('keeps income totals visible without the undated receipt notice', async () => {
  const data = payments(100); data.income.undatedSuccessfulCount = 2; data.income.undatedSuccessfulAmount = 300;
  service.getStaffMedicinePaymentDashboard.mockResolvedValue(data);
  render(<MemoryRouter><PharmacyStaffDashboard /></MemoryRouter>);
  const medicines = await screen.findByRole('region', { name: 'Medicine payments and income' });
  await screen.findByText('Panadol');
  expect(within(medicines).getAllByText(/100\.00/)).toHaveLength(2);
  expect(screen.queryByText(/successful payments have no confirmed date/)).not.toBeInTheDocument();
});

it('keeps verification and recent payment details separate while one service fails', async () => {
  const data = payments(100);
  data.pendingTransfers = { totalCount: 1, items: [{ id: 7, reference: 'CN-PENDING', amount: 50, status: 'ReceiptUnderVerification' }] };
  data.recentPayments = [{ id: 8, reference: 'CN-PAID', amount: 100, method: 'BankTransfer', confirmedAtUtc: time }];
  service.getStaffMedicinePaymentDashboard.mockResolvedValue(data);
  service.getStaffAppointmentPaymentDashboard.mockRejectedValue(new Error());
  render(<MemoryRouter><PharmacyStaffDashboard /></MemoryRouter>);
  expect(await screen.findByText('CN-PENDING')).toBeInTheDocument();
  const transfers = screen.getByRole('region', { name: 'Bank transfers awaiting verification' });
  expect(within(transfers).getByText('Receipt under verification')).toBeInTheDocument();
  expect(within(transfers).queryByText('CN-PAID')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'CN-PAID' })).toHaveAttribute('href', '/pharmacy/payment-transactions/8');
  expect(screen.getByRole('button', { name: /Retry appointment payments and income/i })).toBeInTheDocument();
  expect(within(transfers).queryByText('0')).not.toBeInTheDocument();
});
