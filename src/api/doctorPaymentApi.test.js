import { describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_DOCTOR_PAYMENT_API_BASE_URL", "http://localhost:8080");

const { doctorPaymentApi } = await import("./doctorPaymentApi.js");

describe("doctorPaymentApi", () => {
  it("uses the configured doctor-payment service URL", () => {
    expect(doctorPaymentApi.defaults.baseURL).toBe("http://localhost:8080");
  });
});

describe("doctorPaymentApi default", () => {
  it("falls back to the local service so a missing env var does not 404 every call", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_DOCTOR_PAYMENT_API_BASE_URL", "");

    const { doctorPaymentApi: fallback } = await import("./doctorPaymentApi.js");

    expect(fallback.defaults.baseURL).toBe("http://localhost:5135");
  });
});
