import { doctorPaymentApi } from "../api/doctorPaymentApi.js";

/**
 * Patient doctor search. `criteria` maps straight onto the query string:
 * { search, specialization, availableOnly, page, pageSize }. Blank values are dropped so the URL stays clean.
 * Resolves to { items, page, pageSize, totalCount, totalPages }.
 */
export const searchDoctors = async (criteria = {}) => {
  const params = Object.fromEntries(
    Object.entries(criteria).filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== false),
  );
  const response = await doctorPaymentApi.get("/api/doctors", { params });
  return response.data;
};

/** Distinct specializations currently in use, for the search filter dropdown. */
export const getDoctorSpecializations = async () => {
  const response = await doctorPaymentApi.get("/api/doctors/specializations");
  return response.data;
};

/** A doctor's published profile as patients see it. Resolves to null when the doctor has no published profile. */
export const getDoctorPublicProfile = async (doctorId) => {
  try {
    const response = await doctorPaymentApi.get(`/api/doctors/${encodeURIComponent(doctorId)}`);
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};

/** Professional profile of the signed-in doctor. Resolves to null when none has been created yet. */
export const getMyDoctorProfile = async () => {
  try {
    const response = await doctorPaymentApi.get("/api/doctors/me/profile");
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};

/** Deletes the signed-in doctor's whole professional profile. Resolves even if none existed. */
export const deleteMyDoctorProfile = async () => {
  try {
    await doctorPaymentApi.delete("/api/doctors/me/profile");
  } catch (error) {
    if (error?.response?.status === 404) return;
    throw error;
  }
};

/** Creates or fully replaces the signed-in doctor's professional profile. */
export const saveMyDoctorProfile = async (profile) => {
  const response = await doctorPaymentApi.put("/api/doctors/me/profile", profile);
  return response.data;
};

/** The signed-in doctor's upcoming consultation slots (booked ones included), soonest first. */
export const getMyAvailability = async () => {
  const response = await doctorPaymentApi.get("/api/doctors/me/availability");
  return response.data;
};

/**
 * Publishes an availability window: { startUtc, endUtc, slotDurationMinutes }.
 * Resolves to the slots created. Overlaps and a missing profile surface as a 409 with { message }.
 */
export const addMyAvailability = async (request) => {
  const response = await doctorPaymentApi.post("/api/doctors/me/availability", request);
  return response.data;
};

/**
 * Moves or resizes one open slot: { startUtc, endUtc }. Resolves to the updated slot. A booked slot or an
 * overlap rejects with a 409, a slot that no longer exists with a 404, invalid times with a 400.
 */
export const updateMyAvailabilitySlot = async (slotId, request) => {
  const response = await doctorPaymentApi.put(`/api/doctors/me/availability/${encodeURIComponent(slotId)}`, request);
  return response.data;
};

/** Withdraws one open slot. A 404 (already gone) resolves quietly; a booked slot rejects with a 409. */
export const deleteMyAvailabilitySlot = async (slotId) => {
  try {
    await doctorPaymentApi.delete(`/api/doctors/me/availability/${encodeURIComponent(slotId)}`);
  } catch (error) {
    if (error?.response?.status === 404) return;
    throw error;
  }
};

/**
 * The doctor's consultation fee and fee-change requests:
 * { currentFee, pendingRequest, requests } with requests newest first.
 */
export const getMyFeeChangeRequests = async () => {
  const response = await doctorPaymentApi.get("/api/doctors/me/fee-change-requests");
  return response.data;
};

/**
 * Asks an admin to approve a new consultation fee: { requestedFee }. Resolves to the pending request.
 * Invalid fees reject with a 400, an existing pending request (or no profile) with a 409.
 */
export const submitFeeChangeRequest = async (requestedFee) => {
  const response = await doctorPaymentApi.post("/api/doctors/me/fee-change-requests", { requestedFee });
  return response.data;
};
