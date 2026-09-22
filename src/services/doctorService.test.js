import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPut, mockDelete } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPut: vi.fn(), mockDelete: vi.fn() }));

vi.mock('../api/doctorPaymentApi.js', () => ({
  doctorPaymentApi: { get: mockGet, put: mockPut, delete: mockDelete },
}));

const { deleteMyDoctorProfile, getDoctorPublicProfile, getDoctorSpecializations, getMyDoctorProfile, saveMyDoctorProfile, searchDoctors } = await import('./doctorService.js');

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

describe('doctorService search calls', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('GETs /api/doctors with only the criteria that are set', async () => {
    const body = { items: [], page: 1, pageSize: 12, totalCount: 0, totalPages: 0 };
    mockGet.mockResolvedValue({ data: body });

    await expect(searchDoctors({ search: 'Nimal', specialization: '', availableOnly: false, page: 1, pageSize: 12 })).resolves.toEqual(body);
    expect(mockGet).toHaveBeenCalledWith('/api/doctors', { params: { search: 'Nimal', page: 1, pageSize: 12 } });
  });

  it('sends availableOnly and specialization when they are set', async () => {
    mockGet.mockResolvedValue({ data: { items: [] } });

    await searchDoctors({ search: '', specialization: 'Cardiologist', availableOnly: true, page: 2 });

    expect(mockGet).toHaveBeenCalledWith('/api/doctors', { params: { specialization: 'Cardiologist', availableOnly: true, page: 2 } });
  });

  it('GETs the specializations list', async () => {
    mockGet.mockResolvedValue({ data: ['Cardiologist'] });

    await expect(getDoctorSpecializations()).resolves.toEqual(['Cardiologist']);
    expect(mockGet).toHaveBeenCalledWith('/api/doctors/specializations');
  });

  it('GETs a doctor public profile by id', async () => {
    mockGet.mockResolvedValue({ data: { doctorId: 'abc', fullName: 'Nimal Perera' } });

    await expect(getDoctorPublicProfile('abc')).resolves.toEqual({ doctorId: 'abc', fullName: 'Nimal Perera' });
    expect(mockGet).toHaveBeenCalledWith('/api/doctors/abc');
  });

  it('maps a 404 public profile to null and rethrows other errors', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(getDoctorPublicProfile('abc')).resolves.toBeNull();

    const error = { response: { status: 500 } };
    mockGet.mockRejectedValueOnce(error);
    await expect(getDoctorPublicProfile('abc')).rejects.toBe(error);
  });
});
