import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import HomePage from './HomePage';
import * as service from '../services/roleDashboardService';
const { auth } = vi.hoisted(() => ({ auth: { current: null } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.current }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/publicContentService', () => ({ getHomeContent: async () => ({ introduction: 'Public pharmacy information', services: [], notices: [], featuredMedicines: [], featuredDoctors: [] }) }));
vi.mock('../services/roleDashboardService', () => ({ getPatientOrderDashboard: vi.fn(), getPatientMedicinePaymentDashboard: vi.fn(), getPatientAppointmentDashboard: vi.fn(), getStaffOperationsDashboard: vi.fn(), getStaffMedicinePaymentDashboard: vi.fn(), getStaffAppointmentPaymentDashboard: vi.fn() }));
const time = '2026-10-11T10:00:00Z';
beforeEach(() => {
  vi.resetAllMocks(); auth.current = { user: { userId: 'A', role: 'Patient' }, token: 'A' };
  service.getPatientOrderDashboard.mockResolvedValue({ totalCount: 7, recentOrders: [{ id: 1, reference: 'CN-000001', orderDate: time, status: 'Pending', totalAmount: 100 }], generatedAtUtc: time });
  service.getPatientMedicinePaymentDashboard.mockResolvedValue({ statusCounts: { Paid: 1 }, recentPayments: [{ id: 1, orderId: 1, reference: 'CN-000001', amount: 100, method: 'Cash', status: 'Paid', confirmedAtUtc: time }], generatedAtUtc: time });
  service.getPatientAppointmentDashboard.mockRejectedValue(new Error('Unavailable'));
});
it('shows real owned order/payment information and retains public content and quick links', async () => {
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: /CN-000001/ })).toHaveAttribute('href', '/patient/orders/1');
  expect(screen.getAllByText(/Successful/).length).toBeGreaterThan(0);
  expect(await screen.findByText('Public pharmacy information')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^Medicines Browse/ })).toHaveAttribute('href', '/patient/medicines');
  expect(await screen.findByRole('button', { name: /Retry upcoming appointments/i })).toBeInTheDocument();
});
it('visitors see public content and never request personal records', async () => {
  auth.current = { user: null, token: null };
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  await screen.findByText('Public pharmacy information');
  expect(service.getPatientOrderDashboard).not.toHaveBeenCalled();
  expect(screen.queryByText('CN-000001')).not.toBeInTheDocument();
});
it('keeps order links when medicine payment loading fails', async () => {
  service.getPatientMedicinePaymentDashboard.mockRejectedValue(new Error());
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  await screen.findByRole('link', { name: /CN-000001/ });
  await waitFor(() => expect(screen.getByText(/Payment information unavailable/)).toBeInTheDocument());
});
