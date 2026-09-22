import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPut, mockDelete } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPut: vi.fn(), mockDelete: vi.fn() }));

vi.mock('../api/doctorPaymentApi.js', () => ({
  doctorPaymentApi: { get: mockGet, put: mockPut, delete: mockDelete },
}));

const { deleteMyDoctorProfile, getMyDoctorProfile, saveMyDoctorProfile } = await import('./doctorService.js');

describe('doctorService profile calls', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPut.mockReset();
    mockDelete.mockReset();
  });

  it('DELETEs the profile and treats 404 as already deleted', async () => {
    mockDelete.mockResolvedValueOnce({ status: 204 });
    await expect(deleteMyDoctorProfile()).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledWith('/api/doctors/me/profile');

    mockDelete.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(deleteMyDoctorProfile()).resolves.toBeUndefined();

    mockDelete.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(deleteMyDoctorProfile()).rejects.toBeTruthy();
  });

  it('returns the profile body from the doctor-payment service', async () => {
    mockGet.mockResolvedValue({ data: { id: 1, specialization: 'GP' } });

    await expect(getMyDoctorProfile()).resolves.toEqual({ id: 1, specialization: 'GP' });
    expect(mockGet).toHaveBeenCalledWith('/api/doctors/me/profile');
  });

  it('maps a 404 (no profile yet) to null', async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } });

    await expect(getMyDoctorProfile()).resolves.toBeNull();
  });

  it('rethrows other errors', async () => {
    const error = { response: { status: 500 } };
    mockGet.mockRejectedValue(error);

    await expect(getMyDoctorProfile()).rejects.toBe(error);
  });

  it('PUTs the profile and returns the saved body', async () => {
    const body = { specialization: 'GP', registrationNumber: 'SLMC-1', qualifications: [], experiences: [] };
    mockPut.mockResolvedValue({ data: { id: 5, ...body } });

    await expect(saveMyDoctorProfile(body)).resolves.toEqual({ id: 5, ...body });
    expect(mockPut).toHaveBeenCalledWith('/api/doctors/me/profile', body);
  });
});
