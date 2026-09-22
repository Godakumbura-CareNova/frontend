import { doctorPaymentApi } from "../api/doctorPaymentApi.js";

export const searchDoctors = (criteria) =>
  doctorPaymentApi.get("/api/doctors", { params: criteria });

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
