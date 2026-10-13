import { beforeEach, expect, it, vi } from 'vitest';
import * as service from './adminDashboardService';
import { users, operations, appointments, payments, time } from '../test/adminDashboardFixtures';
const clients = vi.hoisted(() => ({ auth: { get: vi.fn() }, pharmacy: { get: vi.fn() }, payment: { get: vi.fn() }, appointment: { get: vi.fn() } }));
vi.mock('../api/apiClient', () => ({ default: clients.auth }));
vi.mock('../api/pharmacyApi', () => ({ default: clients.pharmacy }));
vi.mock('../api/doctorPaymentApi', () => ({ doctorPaymentApi: clients.payment }));
vi.mock('../api/appointmentApi', () => ({ appointmentApi: clients.appointment }));
beforeEach(() => vi.resetAllMocks());
it('accepts all five module contracts including null appointment payments', async () => {
  for (const [client, loader, data] of [[clients.auth, service.getAdminUserDashboard, users], [clients.pharmacy, service.getAdminOperationsDashboard, operations],
    [clients.appointment, service.getAdminAppointmentDashboard, appointments], [clients.payment, service.getAdminMedicinePaymentDashboard, payments(100)],
    [clients.appointment, service.getAdminAppointmentPaymentDashboard, payments(200)]]) {
    client.get.mockResolvedValue({ status: 200, data }); expect(await loader()).toEqual(data);
  }
  expect(clients.auth.get).toHaveBeenCalledWith('/admin/dashboard/users', { timeout: 15000, handleUnauthorizedLocally: true });
});
it.each([204, 200])('rejects unexpected response content (%s)', async status => {
  clients.auth.get.mockResolvedValue({ status, data: { success: true } });
  await expect(service.getAdminUserDashboard()).rejects.toThrow();
});
it('rejects inconsistent counts, invalid dates, duplicate previews and oversized lists', async () => {
  for (const data of [{ ...users, totalUsers: 1 }, { ...users, doctors: -1 }, { ...users, generatedAtUtc: '2026-02-30T00:00:00Z' }]) {
    clients.auth.get.mockResolvedValue({ status: 200, data }); await expect(service.getAdminUserDashboard()).rejects.toThrow();
  }
  for (const rows of [[operations.recentOrders[0], operations.recentOrders[0]], Array.from({ length: 6 }, (_, i) => ({ ...operations.recentOrders[0], id: i + 1 }))]) {
    clients.pharmacy.get.mockResolvedValue({ status: 200, data: { ...operations, recentOrders: rows } });
    await expect(service.getAdminOperationsDashboard()).rejects.toThrow();
  }
});
it('accepts empty summaries and unknown statuses without claiming a success status', async () => {
  clients.auth.get.mockResolvedValue({ status: 200, data: { totalUsers: 0, patients: 0, doctors: 0, pharmacyStaff: 0, generatedAtUtc: time } });
  expect((await service.getAdminUserDashboard()).totalUsers).toBe(0);
  clients.pharmacy.get.mockResolvedValue({ status: 200, data: { ...operations, orderStatusCounts: { Historical: 7 }, recentOrders: [{ ...operations.recentOrders[0], status: 'Historical' }] } });
  expect((await service.getAdminOperationsDashboard()).recentOrders[0].status).toBe('Historical');
});
it('rejects invalid financial totals', async () => {
  const data = payments(100); data.income.monthAmount = -1;
  clients.payment.get.mockResolvedValue({ status: 200, data }); await expect(service.getAdminMedicinePaymentDashboard()).rejects.toThrow();
});
