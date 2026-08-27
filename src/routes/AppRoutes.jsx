import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import PharmacyStaffDashboard from '../pages/PharmacyStaffDashboard';
import AdminDashboard from '../pages/AdminDashboard';
import UserManagementPage from '../pages/UserManagementPage';

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return '';
  const raw = role.trim().toLowerCase();

  if (raw === 'patient' || raw === 'user') return 'Patient';
  if (raw === 'doctor') return 'Doctor';
  if (raw === 'admin') return 'Admin';
  if (raw === 'pharmacystaff' || raw === 'pharmacy staff') return 'PharmacyStaff';

  return '';
};

const getDashboardRouteByRole = (role) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'Patient') return '/patient-dashboard';
  if (normalizedRole === 'Doctor') return '/doctor-dashboard';
  if (normalizedRole === 'PharmacyStaff') return '/pharmacy-dashboard';
  if (normalizedRole === 'Admin') return '/admin-dashboard';

  return '/forbidden';
};

const HomeRedirect = () => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Navigate to={getDashboardRouteByRole(role)} replace />;
};

const PublicAuthRoute = ({ children }) => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) return null;
  if (isAuthenticated) {
    return <Navigate to={getDashboardRouteByRole(role)} replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/register"
        element={(
          <PublicAuthRoute>
            <RegisterPage />
          </PublicAuthRoute>
        )}
      />
      <Route
        path="/forgot-password"
        element={(
          <PublicAuthRoute>
            <ForgotPasswordPage />
          </PublicAuthRoute>
        )}
      />
      <Route
        path="/reset-password"
        element={(
          <PublicAuthRoute>
            <ResetPasswordPage />
          </PublicAuthRoute>
        )}
      />

      <Route path="/forbidden" element={<ForbiddenPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleProtectedRoute allowedRoles={['Patient', 'Pharmacy Staff', 'Doctor', 'Admin']} />}>
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route element={<RoleProtectedRoute allowedRoles={['Patient']} />}>
          <Route path="/patient-dashboard" element={<PatientDashboard />} />
        </Route>

        <Route element={<RoleProtectedRoute allowedRoles={['Doctor']} />}>
          <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
        </Route>

        <Route element={<RoleProtectedRoute allowedRoles={['Pharmacy Staff', 'PharmacyStaff']} />}>
          <Route path="/pharmacy-dashboard" element={<PharmacyStaffDashboard />} />
        </Route>

        <Route element={<RoleProtectedRoute allowedRoles={['Admin']} />}>
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UserManagementPage />} />
        </Route>
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
