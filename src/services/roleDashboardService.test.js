import { beforeEach, expect, it, vi } from 'vitest';
import { getPatientOrderDashboard, getPatientMedicinePaymentDashboard, getStaffOperationsDashboard, getStaffMedicinePaymentDashboard } from './roleDashboardService';
const { pharmacy, payment } = vi.hoisted(() => ({ pharmacy: { get: vi.fn() }, payment: { get: vi.fn() } }));
vi.mock('../api/pharmacyApi', () => ({ default: pharmacy }));
vi.mock('../api/doctorPaymentApi', () => ({ doctorPaymentApi: payment }));
const time = '2026-10-11T10:00:00Z';
beforeEach(() => vi.clearAllMocks());
it('accepts owned order summaries and preserves complete counts beyond the preview', async () => {
  pharmacy.get.mockResolvedValue({ status: 200, data: { totalCount: 7, recentOrders: [{ id: 1, reference: 'CN-1', orderDate: time, status: 'Pending', totalAmount: 100 }], generatedAtUtc: time } });
  expect((await getPatientOrderDashboard()).totalCount).toBe(7);
});
it.each([204, 200])('rejects unexpected success responses (%s)', async status => {
  pharmacy.get.mockResolvedValue({ status, data: status === 204 ? '' : { success: true } });
  await expect(getPatientOrderDashboard()).rejects.toThrow();
});
it('rejects invalid counts and impossible timestamps', async () => {
  pharmacy.get.mockResolvedValue({ status: 200, data: { totalCount: -1, recentOrders: [], generatedAtUtc: '2026-02-30T00:00:00Z' } });
  await expect(getPatientOrderDashboard()).rejects.toThrow();
});
it('retains unknown payment status rather than claiming success', async () => {
  payment.get.mockResolvedValue({ status: 200, data: { statusCounts: { NewStatus: 1 }, recentPayments: [{ id: 1, orderId: 1, reference: 'CN-1', method: 'Cash', status: 'NewStatus', amount: 100, confirmedAtUtc: null, updatedAtUtc: time }], generatedAtUtc: time } });
  expect((await getPatientMedicinePaymentDashboard()).recentPayments[0].status).toBe('NewStatus');
});
it('rejects missing queue data instead of displaying zero', async () => {
  pharmacy.get.mockResolvedValue({ status: 200, data: { generatedAtUtc: time } });
  await expect(getStaffOperationsDashboard()).rejects.toThrow();
});
it('validates separate dated income and unallocated successful receipts', async () => {
  const data = { pendingTransfers: { totalCount: 0, items: [] }, recentPayments: [], income: { todayAmount: 100, monthAmount: 200, undatedSuccessfulCount: 1, undatedSuccessfulAmount: 50, currency: 'LKR', timeZone: 'Asia/Colombo', asOfUtc: time }, generatedAtUtc: time };
  payment.get.mockResolvedValue({ status: 200, data });
  expect((await getStaffMedicinePaymentDashboard()).income.undatedSuccessfulAmount).toBe(50);
  payment.get.mockResolvedValue({ status: 200, data: { ...data, income: { ...data.income, monthAmount: -1 } } });
  await expect(getStaffMedicinePaymentDashboard()).rejects.toThrow();
});
