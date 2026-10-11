import React from 'react';
import HomePage from '../pages/HomePage';
import AboutUsPage from '../pages/AboutUsPage';
import ContactUsPage from '../pages/ContactUsPage';
import AdminPharmacyInformationPage from '../pages/AdminPharmacyInformationPage';
import AdminContactInquiriesPage from '../pages/AdminContactInquiriesPage';
import PublicNotFoundPage from '../pages/PublicNotFoundPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleProtectedRoute from '../components/RoleProtectedRoute';

import RegisterPage from '../pages/auth/Register';
import LoginPage from '../pages/LoginPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import ForbiddenPage from '../pages/ForbiddenPage';

import ProfilePage from '../pages/ProfilePage';
import PatientDashboard from '../pages/PatientDashboard';
import DoctorDashboard from '../pages/DoctorDashboard';
import DoctorAppointmentsPage from '../pages/DoctorAppointmentsPage';
import DoctorAppointmentDetailsPage from '../pages/DoctorAppointmentDetailsPage';
import DoctorProfilePage from '../pages/DoctorProfilePage';
import PharmacyStaffDashboard from '../pages/PharmacyStaffDashboard';
import AdminDashboard from '../pages/AdminDashboard';

import UserManagementPage from '../pages/UserManagementPage';
import AdminFeeChangeRequestsPage from '../pages/AdminFeeChangeRequestsPage';

import MedicineManagementPage from '../pages/MedicineManagementPage';
import CategoryManagementPage from '../pages/CategoryManagementPage';
import InventoryManagementPage from '../pages/InventoryManagementPage';

import PatientMedicineCataloguePage from '../pages/PatientMedicineCataloguePage';
import PatientMedicineDetailsPage from '../pages/PatientMedicineDetailsPage';
import PatientPrescriptionUploadPage from '../pages/PatientPrescriptionUploadPage';
import PatientPrescriptionsPage from '../pages/PatientPrescriptionsPage';
import PatientCartPage from '../pages/PatientCartPage';
import PatientCheckoutPage from '../pages/PatientCheckoutPage';
import PatientOrdersPage from '../pages/PatientOrdersPage';
import PatientOrderDetailsPage from '../pages/PatientOrderDetailsPage';
import PatientOrderPaymentPage from '../pages/PatientOrderPaymentPage';
import PatientOnlinePaymentPage from '../pages/PatientOnlinePaymentPage';

import PatientDoctorSearchPage from '../pages/PatientDoctorSearchPage';
import PatientDoctorProfilePage from '../pages/PatientDoctorProfilePage';
import PatientAppointmentBookingPage from '../pages/PatientAppointmentBookingPage';
import PatientAppointmentPaymentPage from '../pages/PatientAppointmentPaymentPage';
import PatientAppointmentsPage from '../pages/PatientAppointmentsPage';
import PatientAppointmentDetailsPage from '../pages/PatientAppointmentDetailsPage';

import PharmacyOrderManagementPage from '../pages/PharmacyOrderManagementPage';
import PharmacyPrescriptionReviewPage from '../pages/PharmacyPrescriptionReviewPage';
import PharmacyPaymentVerificationPage from '../pages/PharmacyPaymentVerificationPage';
import AppointmentReceiptVerificationPage from '../pages/AppointmentReceiptVerificationPage';

import PaymentTransactionsPage from '../pages/PaymentTransactionsPage';
import PaymentTransactionDetailPage from '../pages/PaymentTransactionDetailPage';

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return '';

  const raw = role.trim().toLowerCase();

  if (raw === 'patient' || raw === 'user') return 'Patient';
  if (raw === 'doctor') return 'Doctor';
  if (raw === 'admin') return 'Admin';

  if (
    raw === 'pharmacystaff' ||
    raw === 'pharmacy staff'
  ) {
    return 'PharmacyStaff';
  }

  return '';
};

const getDashboardRouteByRole = (role) => {
  switch (normalizeRole(role)) {
    case 'Patient':
      return '/patient-dashboard';

    case 'Doctor':
      return '/doctor-dashboard';

    case 'PharmacyStaff':
      return '/pharmacy-dashboard';

    case 'Admin':
      return '/admin-dashboard';

    default:
      return '/forbidden';
  }
};

const ProfileRoute = () => {
  const { role } = useAuth();

  return normalizeRole(role) === 'Doctor'
    ? <DoctorProfilePage />
    : <ProfilePage />;
};

const PublicAuthRoute = ({ children }) => {
  const {
    isAuthenticated,
    role,
    loading,
  } = useAuth();

  if (loading) return null;

  return isAuthenticated
    ? (
        <Navigate
          to={getDashboardRouteByRole(role)}
          replace
        />
      )
    : children;
};

const MedicineDetailsRoute = () => {
  const { isAuthenticated, role } = useAuth();
  return <PatientMedicineDetailsPage canOrder={isAuthenticated && normalizeRole(role) === 'Patient'} />;
};
const DoctorDetailsRoute = () => {
  const { isAuthenticated, role } = useAuth();
  return <PatientDoctorProfilePage canBook={isAuthenticated && normalizeRole(role) === 'Patient'} />;
};

const AppRoutes = () => (
  <Routes>
    <Route
      path="/login"
      element={<LoginPage />}
    />

    <Route
      path="/register"
      element={
        <PublicAuthRoute>
          <RegisterPage />
        </PublicAuthRoute>
      }
    />

    <Route
      path="/forgot-password"
      element={
        <PublicAuthRoute>
          <ForgotPasswordPage />
        </PublicAuthRoute>
      }
    />

    <Route
      path="/reset-password"
      element={
        <PublicAuthRoute>
          <ResetPasswordPage />
        </PublicAuthRoute>
      }
    />

    <Route
      path="/forbidden"
      element={<ForbiddenPage />}
    />

    <Route element={<ProtectedRoute />}>
      <Route
        element={
          <RoleProtectedRoute
            allowedRoles={[
              'Patient',
              'Pharmacy Staff',
              'PharmacyStaff',
              'Doctor',
              'Admin',
            ]}
          />
        }
      >
        <Route
          path="/profile"
          element={<ProfileRoute />}
        />
      </Route>

      <Route
        element={
          <RoleProtectedRoute
            allowedRoles={['Patient']}
          />
        }
      >
        <Route
          path="/patient-dashboard"
          element={<PatientDashboard />}
        />

<Route
          path="/patient/medicines/:medicineId"
          element={<PatientMedicineDetailsPage />}
        />

        <Route
          path="/patient/prescriptions/upload"
          element={<PatientPrescriptionUploadPage />}
        />

        <Route
          path="/patient/prescriptions"
          element={<PatientPrescriptionsPage />}
        />

        <Route
          path="/patient/cart"
          element={<PatientCartPage />}
        />

        <Route
          path="/patient/checkout"
          element={<PatientCheckoutPage />}
        />

        <Route
          path="/patient/orders"
          element={<PatientOrdersPage />}
        />

        <Route
          path="/patient/orders/:orderId"
          element={<PatientOrderDetailsPage />}
        />

        <Route
          path="/patient/orders/:orderId/payment"
          element={<PatientOrderPaymentPage />}
        />

        <Route
          path="/patient/orders/:orderId/payment/online"
          element={<PatientOnlinePaymentPage />}
        />

<Route
          path="/patient/doctors/:doctorId"
          element={<PatientDoctorProfilePage />}
        />

        <Route
          path="/patient/doctors/:doctorId/book"
          element={<PatientAppointmentBookingPage />}
        />

        <Route
          path="/patient/appointments"
          element={<PatientAppointmentsPage />}
        />

        <Route
          path="/patient/appointments/:appointmentId"
          element={<PatientAppointmentDetailsPage />}
        />

        <Route
          path="/patient/appointments/:appointmentId/payment"
          element={<PatientAppointmentPaymentPage />}
        />
      </Route>

      <Route
        element={
          <RoleProtectedRoute
            allowedRoles={['Doctor']}
          />
        }
      >
        <Route
          path="/doctor-dashboard"
          element={<DoctorDashboard />}
        />
        <Route path="/doctor/appointments" element={<DoctorAppointmentsPage />} />
        <Route path="/doctor/appointments/:appointmentId" element={<DoctorAppointmentDetailsPage />} />
      </Route>

      <Route
        element={
          <RoleProtectedRoute
            allowedRoles={[
              'Pharmacy Staff',
              'PharmacyStaff',
            ]}
          />
        }
      >
        <Route
          path="/pharmacy-dashboard"
          element={<PharmacyStaffDashboard />}
        />

        <Route
          path="/pharmacy/medicines"
          element={<MedicineManagementPage />}
        />

        <Route
          path="/pharmacy/categories"
          element={<CategoryManagementPage />}
        />

        <Route
          path="/pharmacy/inventory"
          element={<InventoryManagementPage />}
        />

        <Route
          path="/pharmacy/orders"
          element={<PharmacyOrderManagementPage />}
        />

        <Route
          path="/pharmacy/prescriptions"
          element={<PharmacyPrescriptionReviewPage />}
        />

        <Route
          path="/pharmacy/payments"
          element={<PharmacyPaymentVerificationPage />}
        />

        <Route
          path="/pharmacy/appointment-payments"
          element={<AppointmentReceiptVerificationPage />}
        />

        <Route
          path="/pharmacy/payment-transactions"
          element={<PaymentTransactionsPage />}
        />

        <Route
          path="/pharmacy/payment-transactions/:paymentId"
          element={<PaymentTransactionDetailPage />}
        />
      </Route>
      <Route element={<RoleProtectedRoute allowedRoles={['Admin']} />}>
        <Route path="/admin/pharmacy-information" element={<AdminPharmacyInformationPage />} />
        <Route path="/admin/inquiries" element={<AdminContactInquiriesPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagementPage />} />
        <Route path="/admin/fee-requests" element={<AdminFeeChangeRequestsPage />} />
        <Route path="/admin/payments" element={<PaymentTransactionsPage />} />
        <Route path="/admin/payments/:paymentId" element={<PaymentTransactionDetailPage />} />
      </Route>
    </Route>

    <Route path="/" element={<HomePage />} />
    <Route path="/about" element={<AboutUsPage />} />
    <Route path="/contact" element={<ContactUsPage />} />
    <Route path="/patient/medicines" element={<PatientMedicineCataloguePage />} />
    <Route path="/patient/medicines/:medicineId" element={<MedicineDetailsRoute />} />
    <Route path="/patient/doctors" element={<PatientDoctorSearchPage />} />
    <Route path="/patient/doctors/:doctorId" element={<DoctorDetailsRoute />} />
    <Route path="/medicines" element={<PatientMedicineCataloguePage />} />
    <Route path="/medicines/:medicineId" element={<MedicineDetailsRoute />} />
    <Route path="/doctors" element={<PatientDoctorSearchPage />} />
    <Route path="/doctors/:doctorId" element={<DoctorDetailsRoute />} />
    <Route path="*" element={<PublicNotFoundPage />} />
  </Routes>
);

export default AppRoutes;
