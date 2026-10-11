import { beforeEach, expect, it, vi } from 'vitest';
import { cancelAppointment, getAppointmentCancellationEligibility } from './appointmentCancellationService';
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../api/appointmentApi', () => ({ appointmentApi: http }));
const result = { appointmentId: 7, appointmentReference: 'CN-7', status: 'Cancelled', cancelledAtUtc: '2026-10-11T10:00:00.1234567Z', refundOutcome: 'Eligible', refundAmount: 1500, refundStatus: 'PendingManualProcessing', reason: null, message: 'Awaiting manual processing.' };
beforeEach(() => vi.resetAllMocks());
it('accepts a persisted cancellation with manual refund eligibility', async () => {
  http.post.mockResolvedValue({ status: 200, data: result });
  expect(await cancelAppointment(7, { expectedVersion: 'a'.repeat(64) })).toEqual(result);
});
it.each([
  { status: 204 }, { status: 200, data: {} }, { status: 200, data: { ...result, appointmentId: 8 } },
  { status: 200, data: { ...result, cancelledAtUtc: '2026-02-30T10:00:00Z' } },
  { status: 200, data: { ...result, refundAmount: -1 } }, { status: 200, data: { ...result, status: 'Booked' } },
  { status: 200, data: { ...result, refundStatus: 'Refunded' } },
])('rejects an unconfirmed cancellation response %#', async response => {
  http.post.mockResolvedValue(response); await expect(cancelAppointment(7, {})).rejects.toThrow(/confirm/i);
});
it('rejects malformed eligibility rather than offering cancellation', async () => {
  http.get.mockResolvedValue({ status: 200, data: { appointmentId: 7, allowed: true } });
  await expect(getAppointmentCancellationEligibility(7)).rejects.toThrow();
});
