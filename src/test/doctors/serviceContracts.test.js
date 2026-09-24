import { expect, it } from "vitest";
import { getDoctorPublicProfile, getDoctorSpecializations, getMyDoctorProfile, saveMyDoctorProfile, searchDoctors } from "../../services/doctorService.js";
import { getMedicinePayment, getMedicinePaymentOptions, selectMedicinePaymentMethod } from "../../services/paymentService.js";

it("exports the doctor-search service functions", () => {
  expect(typeof searchDoctors).toBe("function");
  expect(typeof getDoctorSpecializations).toBe("function");
  expect(typeof getDoctorPublicProfile).toBe("function");
});

it("exports the doctor profile service functions", () => {
  expect(typeof getMyDoctorProfile).toBe("function");
  expect(typeof saveMyDoctorProfile).toBe("function");
});

it("exports the medicine payment service functions", () => {
  expect(typeof getMedicinePaymentOptions).toBe("function");
  expect(typeof selectMedicinePaymentMethod).toBe("function");
  expect(typeof getMedicinePayment).toBe("function");
});
