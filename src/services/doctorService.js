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
