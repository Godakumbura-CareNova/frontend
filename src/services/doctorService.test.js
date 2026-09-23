import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPut, mockPost, mockDelete } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPut: vi.fn(), mockPost: vi.fn(), mockDelete: vi.fn() }));

vi.mock('../api/doctorPaymentApi.js', () => ({
  doctorPaymentApi: { get: mockGet, put: mockPut, post: mockPost, delete: mockDelete },
}));

const {
  addMyAvailability,
  deleteMyAvailabilitySlot,
  deleteMyDoctorProfile,
  getDoctorPublicProfile,
  getDoctorSpecializations,
  getMyAvailability,
  getMyDoctorProfile,
  saveMyDoctorProfile,
  searchDoctors,
} = await import('./doctorService.js');

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

describe('doctorService availability calls', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
  });

  it('GETs the signed-in doctor slots', async () => {
    const slots = [{ id: 1, startUtc: '2026-10-01T09:00:00Z', endUtc: '2026-10-01T09:20:00Z', isBooked: false }];
    mockGet.mockResolvedValue({ data: slots });

    await expect(getMyAvailability()).resolves.toEqual(slots);
    expect(mockGet).toHaveBeenCalledWith('/api/doctors/me/availability');
  });

  it('POSTs an availability window and returns the created slots', async () => {
    const request = { startUtc: '2026-10-01T09:00:00Z', endUtc: '2026-10-01T10:00:00Z', slotDurationMinutes: 20 };
    mockPost.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] });

    await expect(addMyAvailability(request)).resolves.toHaveLength(3);
    expect(mockPost).toHaveBeenCalledWith('/api/doctors/me/availability', request);
  });

  it('rethrows a 409 conflict from POST so the page can show the message', async () => {
    const error = { response: { status: 409, data: { message: 'overlap' } } };
    mockPost.mockRejectedValue(error);

    await expect(addMyAvailability({})).rejects.toBe(error);
  });

  it('DELETEs a slot, treats 404 as already gone and rethrows other errors', async () => {
    mockDelete.mockResolvedValueOnce({ status: 204 });
    await expect(deleteMyAvailabilitySlot(7)).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledWith('/api/doctors/me/availability/7');

    mockDelete.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(deleteMyAvailabilitySlot(7)).resolves.toBeUndefined();

    const booked = { response: { status: 409 } };
    mockDelete.mockRejectedValueOnce(booked);
    await expect(deleteMyAvailabilitySlot(7)).rejects.toBe(booked);
  });
});
