import { beforeEach, expect, it, vi } from 'vitest';
import { getDoctorAppointment, getDoctorAppointments, updateDoctorAppointmentStatus } from './doctorAppointmentService';
const http = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('../api/appointmentApi', () => ({ appointmentApi: http }));
beforeEach(() => vi.resetAllMocks());
it.each([undefined, null, {}, { appointments: [] }])('rejects an invalid schedule response %j', async data => {
  http.get.mockResolvedValue({ data }); await expect(getDoctorAppointments()).rejects.toThrow();
});
it('rejects a detail response for a different appointment', async () => {
  http.get.mockResolvedValue({ data: { id: 9, appointmentReference: 'WRONG' } }); await expect(getDoctorAppointment(7)).rejects.toThrow();
});
it.each([{ status: 204 }, { status: 200, data: {} }, { status: 200, data: { id: 7, status: 'Booked', updatedAtUtc: '2026-10-11T10:00:00Z' } }, { status: 200, data: { id: 7, status: 'Completed', updatedAtUtc: 'bad' } }])('rejects an unconfirmed status update %j', async response => {
  http.patch.mockResolvedValue(response); await expect(updateDoctorAppointmentStatus(7, { status: 'Completed', expectedStatus: 'Booked', expectedUpdatedAtUtc: null })).rejects.toThrow();
});
it('accepts only a matching update confirmation', async () => {
  const data = { id: 7, status: 'Completed', updatedAtUtc: '2026-10-11T10:00:00Z' }; http.patch.mockResolvedValue({ status: 200, data });
  expect(await updateDoctorAppointmentStatus(7, { status: 'Completed', expectedStatus: 'Booked', expectedUpdatedAtUtc: null })).toEqual(data);
});

it.each(['0Z', '2026-02-30T10:00:00Z', '2026-10-11T25:00:00Z', '2026-10-11T10:00:00+00:00'])('rejects malformed UTC confirmation timestamp %s', async updatedAtUtc => {
  http.patch.mockResolvedValue({ status: 200, data: { id: 7, status: 'Completed', updatedAtUtc } });
  await expect(updateDoctorAppointmentStatus(7, { status: 'Completed' })).rejects.toThrow();
});

it('accepts .NET UTC timestamps with seven fractional digits', async () => {
  const data = { id: 7, status: 'Completed', updatedAtUtc: '2026-10-11T10:00:00.1234567Z' }; http.patch.mockResolvedValue({ status: 200, data });
  expect(await updateDoctorAppointmentStatus(7, { status: 'Completed' })).toEqual(data);
});
