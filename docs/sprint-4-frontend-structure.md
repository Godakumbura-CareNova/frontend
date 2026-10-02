# Sprint 4 frontend structure (GCN-44 to GCN-53)

Empty placeholder files mark where each Sprint 4 story is built. Existing
Sprint 1-3 files are unchanged; the feature code is left to the developers.

| Story | Files |
| --- | --- |
| GCN-44 Appointment booking and time slots | `pages/PatientAppointmentBookingPage.jsx`, `services/appointmentService.js`, `utils/appointmentValidation.js`, `components/appointments/` |
| GCN-45 Appointment payment | `pages/PatientAppointmentPaymentPage.jsx`, `services/appointmentPaymentService.js` |
| GCN-46 View and manage my appointments | `pages/PatientAppointmentsPage.jsx`, `pages/PatientAppointmentDetailsPage.jsx` |
| GCN-47 Doctor appointment management | `pages/DoctorAppointmentsPage.jsx` |
| GCN-48 Cancellation and refund rules | `services/appointmentCancellationService.js`, `utils/appointmentCancellationRules.js` |
| GCN-49 Public home page | `pages/HomePage.jsx`, `components/home/`, `services/publicContentService.js` |
| GCN-50 About us and contact pages | `pages/AboutUsPage.jsx`, `pages/ContactUsPage.jsx`, `api/contactApi.js`, `utils/contactValidation.js` |
| GCN-51 to GCN-53 Dashboards | `api/dashboardApi.js`, `services/dashboardService.js`, `components/dashboard/` (existing dashboard pages are extended in place) |

`api/appointmentApi.js` is the client for the `appointment-integration`
service. Tests go in `src/test/appointments`, `src/test/dashboard` and
`src/test/public`.

## Configuration

The appointment service is reached through `VITE_APPOINTMENT_API_BASE_URL`;
do not hard-code service addresses in components.

- Local: `http://localhost:5136`
- Deployed: `https://carenova-gateway-cwa9etfmdtgvazgm.centralindia-01.azurewebsites.net/appointment`
  (once the gateway route is added)

The variable is set in `.env.example`, as an `ARG`/`ENV` in the `Dockerfile`
build stage, and as a build argument in `.github/workflows/ci.yml` and
`cd.yml`. Copy it into your local `.env.local` to run against a local
appointment service.
