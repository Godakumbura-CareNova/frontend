# Sprint 3 Frontend Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add non-breaking Sprint 3 frontend boundaries and API configuration for the independent doctor-payment service.

**Architecture:** Preserve the existing React/Vite folder layout. Add a dedicated Axios client configured by `VITE_DOCTOR_PAYMENT_API_BASE_URL`, then add empty-but-tracked feature locations and developer documentation; story user interfaces remain out of scope.

**Tech Stack:** React 18, Vite 5, Axios, Vitest, Docker, Nginx, GitHub Actions.

**Spec:** `D:/CareNove Devops/doctor-payment-service/docs/superpowers/specs/2026-09-18-sprint-3-doctor-payment-design.md`

## Global Constraints

- Do not move, rename, or break existing Sprint 1 and Sprint 2 frontend files.
- Address the service only through `VITE_DOCTOR_PAYMENT_API_BASE_URL`; never hard-code the deployment URL.
- Do not add business screens, payment-provider secrets, Kafka, or Docker Compose in this scaffold.
- Production service URLs are build variables; credentials remain in GitHub/Azure secret stores.

---

### Task 1: Add environment-driven doctor-payment API client

**Files:**
- Create: `src/api/doctorPaymentApi.js`
- Create: `src/api/doctorPaymentApi.test.js`
- Create: `.env.example`
- Modify: `Dockerfile`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/cd.yml`

**Interfaces:**
- Produces: `doctorPaymentApi`, an Axios client whose base URL is `import.meta.env.VITE_DOCTOR_PAYMENT_API_BASE_URL`.
- Produces: `VITE_DOCTOR_PAYMENT_API_BASE_URL` as a documented Docker build argument and workflow build variable.

- [ ] **Step 1: Write the failing API-client test**

```js
import { describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_DOCTOR_PAYMENT_API_BASE_URL", "http://localhost:8080");

const { doctorPaymentApi } = await import("./doctorPaymentApi.js");

describe("doctorPaymentApi", () => {
  it("uses the configured doctor-payment service URL", () => {
    expect(doctorPaymentApi.defaults.baseURL).toBe("http://localhost:8080");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails before the module exists**

Run: `npm run test:run -- src/api/doctorPaymentApi.test.js`

Expected: FAIL because `doctorPaymentApi.js` does not exist.

- [ ] **Step 3: Add the minimal Axios client and safe environment example**

```js
import axios from "axios";

const baseURL = import.meta.env.VITE_DOCTOR_PAYMENT_API_BASE_URL;

export const doctorPaymentApi = axios.create({ baseURL });
```

Put this single non-secret line in `.env.example`:

```text
VITE_DOCTOR_PAYMENT_API_BASE_URL=http://localhost:8080
```

Add `ARG VITE_DOCTOR_PAYMENT_API_BASE_URL` and `ENV VITE_DOCTOR_PAYMENT_API_BASE_URL=$VITE_DOCTOR_PAYMENT_API_BASE_URL` to the Docker build stage. Add the same build argument to CI and CD; CD obtains its production value from a GitHub secret or environment variable.

- [ ] **Step 4: Run the focused test and production build**

Run: `npm run test:run -- src/api/doctorPaymentApi.test.js` and `npm run build`.

Expected: both commands exit with code 0.

- [ ] **Step 5: Commit API configuration**

```bash
git add src/api/doctorPaymentApi.js src/api/doctorPaymentApi.test.js .env.example Dockerfile .github/workflows
git commit -m "chore: configure doctor payment API client"
```

### Task 2: Add tracked Sprint 3 feature boundaries and documentation

**Files:**
- Create: `src/components/doctors/.gitkeep`
- Create: `src/components/payments/.gitkeep`
- Create: `src/services/doctorService.js`
- Create: `src/services/paymentService.js`
- Create: `src/utils/doctorValidation.js`
- Create: `src/utils/paymentValidation.js`
- Create: `src/test/doctors/.gitkeep`
- Create: `src/test/payments/.gitkeep`
- Modify: `README.md`

**Interfaces:**
- Consumes: `doctorPaymentApi` from Task 1.
- Produces: empty feature boundaries and service module contracts for later developers.

- [ ] **Step 1: Write the failing module-contract tests**

```js
import { expect, it } from "vitest";
import { searchDoctors } from "../../services/doctorService.js";
import { createPayment } from "../../services/paymentService.js";

it("exports the doctor-search service function", () => {
  expect(typeof searchDoctors).toBe("function");
});

it("exports the payment-creation service function", () => {
  expect(typeof createPayment).toBe("function");
});
```

- [ ] **Step 2: Run tests to verify they fail before service modules exist**

Run: `npm run test:run -- src/test/doctors/serviceContracts.test.js`

Expected: FAIL because the service modules do not exist.

- [ ] **Step 3: Add minimal contracts that delegate to the configured client**

```js
// src/services/doctorService.js
import { doctorPaymentApi } from "../api/doctorPaymentApi.js";

export const searchDoctors = (criteria) =>
  doctorPaymentApi.get("/api/doctors", { params: criteria });
```

```js
// src/services/paymentService.js
import { doctorPaymentApi } from "../api/doctorPaymentApi.js";

export const createPayment = (payload) =>
  doctorPaymentApi.post("/api/payments", payload);
```

Create the approved component, validation, and test folders with `.gitkeep`. The README must state that doctor UI, payment UI, validation rules, and final routes are assigned to Sprint 3 developers and are not supplied by this DevOps scaffold.

- [ ] **Step 4: Run all frontend tests and build**

Run: `npm run test:run` and `npm run build`.

Expected: both commands exit with code 0 and no existing page or route files are modified.

- [ ] **Step 5: Commit feature boundaries**

```bash
git add src/components src/services src/utils src/test README.md
git commit -m "chore: add sprint 3 frontend boundaries"
```

