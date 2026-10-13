import { beforeEach, expect, it, vi } from 'vitest';
import { reportingPeriod, loadMedicineReport, loadAppointmentReport } from './adminReportService';
const clients = vi.hoisted(() => ({ payments: { get: vi.fn() }, pharmacy: { get: vi.fn() }, appointments: { get: vi.fn() } }));
vi.mock('../api/doctorPaymentApi', () => ({ doctorPaymentApi: clients.payments }));
vi.mock('../api/pharmacyApi', () => ({ default: clients.pharmacy }));
vi.mock('../api/appointmentApi', () => ({ appointmentApi: clients.appointments }));
const generatedAtUtc = '2026-10-12T00:00:00Z';
const meta = { generatedAtUtc, currency: 'LKR', timeZone: 'Asia/Colombo', undatedSuccessfulCount: 0 };
const period = () => reportingPeriod('daily', '2026-10-01');
const row = (id = 1) => ({ id, orderId: id, patientId: 'patient', amount: 100, confirmedAtUtc: '2026-09-30T18:30:00Z' });
const response = items => ({ status: 200, data: { ...meta, items, totalCount: items.length, page: 1, pageSize: 100, totalPages: items.length ? 1 : 0 } });
const costs = items => ({ status: 200, data: items.map(p => ({ orderId: p.orderId, customerId: p.patientId, totalAmount: p.amount, buyingCost: 60 })) });
beforeEach(() => vi.resetAllMocks());
it('uses Sri Lanka boundaries, Monday weeks and leap-year month length', () => {
  expect(period().from).toBe('2026-09-30T18:30:00.000Z'); expect(period().to).toBe('2026-10-01T18:30:00.000Z');
  expect(reportingPeriod('weekly', '2026-11-01').dates).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  expect(reportingPeriod('monthly', '2028-02-15').dates).toHaveLength(29);
  expect(() => reportingPeriod('daily', '2026-02-30')).toThrow();
});
it('calculates paid income, allocated buying cost and estimated gross profit', async () => {
  clients.payments.get.mockResolvedValue(response([row()])); clients.pharmacy.get.mockResolvedValue(costs([row()]));
  const data = await loadMedicineReport(period());
  expect(data.income).toBe(100); expect(data.buyingCost).toBe(60); expect(data.profit).toBe(40);
  expect(data.days[0]).toMatchObject({ date: '2026-10-01', income: 100, buyingCost: 60, profit: 40 });
  expect(clients.pharmacy.get.mock.calls[0][1].params.getAll('orderIds')).toEqual(['1']);
});
it('does not claim profit when costs are missing or ownership mismatches', async () => {
  clients.payments.get.mockResolvedValue(response([row(1), row(2)]));
  clients.pharmacy.get.mockResolvedValue({ status: 200, data: [{ orderId: 1, customerId: 'other-patient', totalAmount: 100, buyingCost: 1 }] });
  const data = await loadMedicineReport(period());
  expect(data.income).toBe(200); expect(data.profit).toBeNull(); expect(data.missingCostCount).toBe(2);
  expect(data.days[0].profit).toBeNull();
});
it('fetches all pages and bounded cost batches rather than reporting only the first 100', async () => {
  const rows = Array.from({ length: 101 }, (_, i) => row(i + 1));
  clients.payments.get.mockImplementation(async (_, options) => ({ status: 200, data: { ...meta, totalCount: 101, totalPages: 2, pageSize: 100,
    page: options.params.page, items: options.params.page === 1 ? rows.slice(0, 100) : rows.slice(100) } }));
  clients.pharmacy.get.mockImplementation(async (_, options) => costs(options.params.getAll('orderIds').map(id => row(Number(id)))));
  const data = await loadMedicineReport(period());
  expect(data.income).toBe(10100); expect(data.buyingCost).toBe(6060); expect(data.profit).toBe(4040);
  expect(clients.payments.get).toHaveBeenCalledTimes(2); expect(clients.pharmacy.get).toHaveBeenCalledTimes(2);
});
it('supports losses and valid empty periods without requesting costs', async () => {
  clients.payments.get.mockResolvedValue(response([row()])); clients.pharmacy.get.mockResolvedValue({ status: 200, data: [{ orderId: 1, customerId: 'patient', totalAmount: 100, buyingCost: 150 }] });
  expect((await loadMedicineReport(period())).profit).toBe(-50);
  clients.payments.get.mockResolvedValue(response([])); clients.pharmacy.get.mockClear();
  expect((await loadMedicineReport(period())).profit).toBe(0); expect(clients.pharmacy.get).not.toHaveBeenCalled();
});
it('rejects unexpected content, duplicate payments and changing page totals', async () => {
  clients.payments.get.mockResolvedValue({ status: 204, data: null }); await expect(loadMedicineReport(period())).rejects.toThrow();
  clients.payments.get.mockResolvedValue(response([row(), row()])); await expect(loadMedicineReport(period())).rejects.toThrow();
  clients.payments.get.mockImplementation(async (_, options) => ({ status: 200, data: { ...meta, totalCount: options.params.page === 1 ? 101 : 100,
    totalPages: options.params.page === 1 ? 2 : 1, page: options.params.page, pageSize: 100,
    items: options.params.page === 1 ? Array.from({ length: 100 }, (_, i) => row(i + 1)) : [] } }));
  await expect(loadMedicineReport(period())).rejects.toThrow();
});
it('keeps consultation fees separate and fills empty days with zero', async () => {
  clients.appointments.get.mockResolvedValue({ status: 200, data: { ...meta, undatedSuccessfulCount: 2, days: [{ date: '2026-10-01', amount: 500, count: 1 }] } });
  const data = await loadAppointmentReport(reportingPeriod('weekly', '2026-10-01'));
  expect(data.income).toBe(500); expect(data.days).toHaveLength(7); expect(data.days[0].amount).toBe(0);
  expect(data.undatedSuccessfulCount).toBe(2); expect(data.profit).toBeUndefined();
});
