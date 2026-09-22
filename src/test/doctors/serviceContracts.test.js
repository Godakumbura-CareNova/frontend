import { expect, it } from "vitest";
import { getMyDoctorProfile, saveMyDoctorProfile, searchDoctors } from "../../services/doctorService.js";
import { createPayment } from "../../services/paymentService.js";

it("exports the doctor-search service function", () => {
  expect(typeof searchDoctors).toBe("function");
});

it("exports the doctor profile service functions", () => {
  expect(typeof getMyDoctorProfile).toBe("function");
  expect(typeof saveMyDoctorProfile).toBe("function");
});

it("exports the payment-creation service function", () => {
  expect(typeof createPayment).toBe("function");
});
