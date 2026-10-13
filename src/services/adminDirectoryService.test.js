import { beforeEach, expect, it, vi } from 'vitest';
import { loadAdminDirectory } from './adminDirectoryService';
const clients = vi.hoisted(() => ({ auth: { get: vi.fn() }, pharmacy: { get: vi.fn() }, appointment: { get: vi.fn() } }));
vi.mock('../api/apiClient', () => ({ default: clients.auth }));
vi.mock('../api/pharmacyApi', () => ({ default: clients.pharmacy }));
vi.mock('../api/appointmentApi', () => ({ appointmentApi: clients.appointment }));
beforeEach(() => vi.resetAllMocks());
it('filters doctors including inactive and searches/pages only doctor accounts', async () => {
  clients.auth.get.mockResolvedValue({ status: 200, data: [
    { id: 'a', role: 'Doctor', fullName: 'Dr Green', email: 'a@test', mobileNumber: '077', isActive: false },
    { id: 'b', role: 'Patient', fullName: 'Patient', isActive: true },
    { id: 'c', role: ' doctor ', fullName: 'Dr Blue', email: 'c@test', isActive: true }] });
  const data = await loadAdminDirectory('doctors', { page: 2, pageSize: 1, search: 'Dr' });
  expect(data.totalCount).toBe(2); expect(data.items[0].id).toBe('a');
  expect(clients.auth.get).toHaveBeenCalledWith('/admin/users', expect.objectContaining({ handleUnauthorizedLocally: true }));
});
it('enriches only the listed appointments with patient names', async () => {
  clients.appointment.get.mockResolvedValue({ status: 200, data: { items: [{ id: 1, patientId: 'p' }], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 } });
  clients.auth.get.mockResolvedValue({ status: 200, data: [{ id: 'p', fullName: 'Patient One' }] });
  const data = await loadAdminDirectory('appointments', { page: 1, pageSize: 20, search: '' });
  expect(data.items[0].patientName).toBe('Patient One');
});
it('retains appointments with an explicit name warning if user service is unavailable', async () => {
  clients.appointment.get.mockResolvedValue({ status: 200, data: { items: [{ id: 1, patientId: 'p' }], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 } });
  clients.auth.get.mockRejectedValue(new Error('offline'));
  const data = await loadAdminDirectory('appointments', { page: 1, pageSize: 20 });
  expect(data.items[0].patientName).toBe('Patient name unavailable'); expect(data.warning).toBeTruthy();
});
it('does not hide an authorization failure during patient lookup', async () => {
  clients.appointment.get.mockResolvedValue({ status: 200, data: { items: [{ id: 1, patientId: 'p' }], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 } });
  clients.auth.get.mockRejectedValue({ response: { status: 403 } });
  await expect(loadAdminDirectory('appointments', { page: 1, pageSize: 20 })).rejects.toMatchObject({ response: { status: 403 } });
});
it.each([204, 200])('rejects malformed medicine responses (%s)', async status => {
  clients.pharmacy.get.mockResolvedValue({ status, data: { items: [] } });
  await expect(loadAdminDirectory('medicines', { page: 1, pageSize: 20 })).rejects.toThrow();
});
