import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminDashboard from './AdminDashboard';
import * as service from '../services/adminDashboardService';
import { users, operations, appointments, payments } from '../test/adminDashboardFixtures';
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'admin', role: 'Admin' }, token: 'admin' }) }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/adminDashboardService', () => ({ getAdminUserDashboard: vi.fn(), getAdminOperationsDashboard: vi.fn(), getAdminAppointmentDashboard: vi.fn(), getAdminMedicinePaymentDashboard: vi.fn(), getAdminAppointmentPaymentDashboard: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks(); service.getAdminUserDashboard.mockResolvedValue(users); service.getAdminOperationsDashboard.mockResolvedValue(operations);
  service.getAdminAppointmentDashboard.mockResolvedValue(appointments); service.getAdminMedicinePaymentDashboard.mockResolvedValue(payments(100));
  service.getAdminAppointmentPaymentDashboard.mockResolvedValue(payments(200));
});
it('shows real module information and shortcuts within admin permissions', async () => {
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
  expect(await screen.findByText('CN-1')).toBeInTheDocument(); expect(screen.getByText('APT-1')).toBeInTheDocument();
  expect(screen.getByText('Low medicine')).toBeInTheDocument(); expect(screen.getByText('Dr Test')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^Total Users/ })).toHaveTextContent('10');
  for (const [name, target] of [['Total Users', '/admin/users'], ['Patients', '/admin/users'], ['Pharmacy Staff', '/admin/users'], ['Doctors', '/admin/doctors'],
    ['Medicine Orders', '#admin-orders'], ['Appointments', '/admin/appointments'], ['Sales Totals', '#admin-income'],
    ['Payment Summary', '#admin-payment-summary'], ['Low-Stock Alerts', '#admin-low-stock']]) {
    expect(screen.getByRole('link', { name: new RegExp(`^${name}`) })).toHaveAttribute('href', target);
    if (target.startsWith('#')) expect(document.getElementById(target.slice(1))).toBeInTheDocument();
  }
  expect(screen.getAllByRole('link').every(link => !/\/(pharmacy|doctor)\//.test(link.getAttribute('href')))).toBe(true);
  expect(within(screen.getByRole('region', { name: 'Medicine payments and income' })).getAllByText(/100\.00/).length).toBe(2);
  expect(within(screen.getByRole('region', { name: 'Appointment payments and income' })).getAllByText(/200\.00/).length).toBe(2);
  expect(screen.getByRole('link', { name: /Manage Users/ })).toHaveAttribute('href', '/admin/users');
});
it('shows partial failure and retries a single section without pretending it is zero', async () => {
  service.getAdminUserDashboard.mockRejectedValue(new Error());
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Retry user statistics' });
  expect(screen.getByRole('link', { name: /^Total Users/ })).toHaveTextContent('Unavailable');
  expect(await screen.findByText('CN-1')).toBeInTheDocument();
  service.getAdminUserDashboard.mockResolvedValue(users);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry user statistics' }));
  expect(await screen.findByText('10')).toBeInTheDocument();
  expect(service.getAdminOperationsDashboard).toHaveBeenCalledTimes(1);
});
it('keeps the low-stock shortcut target available when operations cannot load', async () => {
  service.getAdminOperationsDashboard.mockRejectedValue(new Error());
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Retry medicine order activity' });
  expect(document.getElementById('admin-low-stock')).toBeInTheDocument();
});
it('retains labelled stale data after refresh failure and warns about undated income', async () => {
  const p = payments(100); p.income.undatedSuccessfulCount = 1; p.income.undatedSuccessfulAmount = 50;
  service.getAdminMedicinePaymentDashboard.mockResolvedValue(p);
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
  await screen.findByText('CN-1');
  expect(screen.getByText(/1 successful payments have no confirmed date/)).toBeInTheDocument();
  service.getAdminOperationsDashboard.mockRejectedValueOnce(new Error());
  await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh dashboard' }));
  expect(await screen.findByText(/Showing the last loaded information/)).toBeInTheDocument();
  expect(screen.getByText('CN-1')).toBeInTheDocument();
});
it('shows empty queues as valid zero data', async () => {
  service.getAdminOperationsDashboard.mockResolvedValue({ ...operations, totalOrders: 0, orderStatusCounts: {}, recentOrders: [], lowStock: { totalCount: 0, items: [] } });
  service.getAdminAppointmentDashboard.mockResolvedValue({ ...appointments, totalAppointments: 0, todayCount: 0, upcomingCount: 0, statusCounts: {}, recentAppointments: [] });
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
  expect(await screen.findByText('No medicine orders yet.')).toBeInTheDocument();
  expect(screen.getByText('No appointments yet.')).toBeInTheDocument();
  expect(screen.getByText('No low-stock alerts.')).toBeInTheDocument();
});
