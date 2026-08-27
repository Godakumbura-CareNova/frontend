# CareNova Frontend (`carenova-frontend`) - Sprint 01

The **CareNova Web Frontend** is built with **React.js**, **Vite**, and **React Router DOM**, providing role-based portals for Patients, Pharmacy Staff, Doctors, and Administrators.

---

## Directory & Architectural Overview

```
carenova-frontend/
├── .github/workflows/
│   ├── ci.yml                 # Continuous Integration Pipeline
│   └── cd.yml                 # Continuous Deployment Pipeline
├── src/
│   ├── api/                   # Axios API Clients & Endpoints
│   │   ├── apiClient.js       # Core HTTP Client with Bearer Auth Interceptor
│   │   ├── authApi.js         # Authentication Endpoints
│   │   ├── profileApi.js      # Profile Endpoints
│   │   └── userApi.js         # Admin User Management Endpoints
│   ├── components/            # Reusable UI Components & Route Protection
│   │   ├── Navbar.jsx         # Responsive Role-aware Header
│   │   ├── ProtectedRoute.jsx # Auth Guard
│   │   └── RoleProtectedRoute.jsx # RBAC Role Guard
│   ├── context/
│   │   └── AuthContext.jsx    # React Context Provider for Authentication
│   ├── pages/                 # Role Dashboards & Authentication Views
│   │   ├── LoginPage.jsx
│   │   ├── RegisterPage.jsx
│   │   ├── ForgotPasswordPage.jsx
│   │   ├── ResetPasswordPage.jsx
│   │   ├── ProfilePage.jsx
│   │   ├── PatientDashboard.jsx
│   │   ├── PharmacyStaffDashboard.jsx
│   │   ├── DoctorDashboard.jsx
│   │   ├── AdminDashboard.jsx
│   │   └── UserManagementPage.jsx
│   ├── routes/
│   │   └── AppRoutes.jsx      # Central Router Configuration
│   ├── utils/
│   │   └── validation.js      # Form Input & Email/Password Validators
│   ├── App.jsx                # Main Application Shell
│   ├── main.jsx               # Entry Point
│   └── index.css              # Premium Glassmorphism & Responsive CSS
├── tests/
│   └── selenium/              # End-to-End Browser Automation Tests
│       ├── RegistrationTests.cs
│       ├── LoginTests.cs
│       ├── ProfileTests.cs
│       └── RoleAccessTests.cs
├── Dockerfile                 # Multi-stage Containerization Setup
└── vite.config.js             # Vite Development Config
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Build for Production
```bash
npm run build
```

---

##  Test Accounts

For verifying role-based dashboards and redirection locally, use the same accounts across the team rather than inventing your own. Each needs to be **registered once through the app, then promoted via SQL** on your own local MySQL (`Role` isn't selectable at registration — it's always created as `User`/Patient by default):

| Role | Email | Password |
|---|---|---|
| Patient | `test-patient@carenova.dev` | `Patient@2026` |
| Doctor | `test-doctor@carenova.dev` | `Doctor@2026` |
| Pharmacy Staff | `test-pharmacy@carenova.dev` | `Pharmacy@2026` |
| Admin | `admin@carenova.dev` | `Admin@2026` |

Promotion (run on the auth-service's `carenova_user_auth` database, after registering the account through the Register page):

UPDATE Users SET Role = 'Doctor' WHERE Email = 'test-doctor@carenova.dev';
UPDATE Users SET Role = 'PharmacyStaff' WHERE Email = 'test-pharmacy@carenova.dev';
UPDATE Users SET Role = 'Admin' WHERE Email = 'admin@carenova.dev';

Patient needs no promotion — register `test-patient@carenova.dev` and it stays the default role.

## Key Features
- **Role-Based Access Control (RBAC)**: Support for `Patient`, `Doctor`, `PharmacyStaff`, and `Admin` roles.
- **Glassmorphism UI Design**: Rich aesthetic palette, dynamic status indicators, and responsive grid layouts.
- **Automated E2E Selenium Tests**: Comprehensive C# test suite covering complete user journeys.
