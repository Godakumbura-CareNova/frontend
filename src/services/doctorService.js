import { doctorPaymentApi } from "../api/doctorPaymentApi.js";

export const searchDoctors = (criteria) =>
  doctorPaymentApi.get("/api/doctors", { params: criteria });
