import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleProtectedRoute from '../components/RoleProtectedRoute';
import RegisterPage from '../pages/auth/Register';
import LoginPage from '../pages/LoginPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import ProfilePage from '../pages/ProfilePage';
import PatientDashboard from '../pages/PatientDashboard';
import DoctorDashboard from '../pages/DoctorDashboard';
import PharmacyStaffDashboard from '../pages/PharmacyStaffDashboard';
import AdminDashboard from '../pages/AdminDashboard';
import UserManagementPage from '../pages/UserManagementPage';

const getDashboardRouteByRole = (role) => {
  switch (role) {
    case 'Patient':
      return '/patient-dashboard';
    case 'Doctor':
      return '/doctor-dashboard';
    case 'PharmacyStaff':
      return '/pharmacy-dashboard';
    case 'Admin':
      return '/admin-dashboard';
    default:
      return '/profile';
  }
};

const HomeRedirect = () => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDashboardRouteByRole(role)} replace />;
};

const PublicAuthRoute = ({ children }) => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to={getDashboardRouteByRole(role)} replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage />}
      />
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

      <Route element={<ProtectedRoute />}>
        <Route path="/profile" element={<ProfilePage />} />

        <Route element={<RoleProtectedRoute allowedRoles={['Patient']} />}>
          <Route path="/patient-dashboard" element={<PatientDashboard />} />
        </Route>

        <Route element={<RoleProtectedRoute allowedRoles={['Doctor']} />}>
          <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
        </Route>

        <Route element={<RoleProtectedRoute allowedRoles={['PharmacyStaff']} />}>
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
