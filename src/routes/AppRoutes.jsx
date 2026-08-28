import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import ProtectedRoute from '../components/ProtectedRoute';
import RoleProtectedRoute from '../components/RoleProtectedRoute';
import { useAuth } from '../context/AuthContext';

const HomeRedirect = () => {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'Patient') return <Navigate to="/patient-dashboard" replace />;
  if (role === 'Doctor') return <Navigate to="/doctor-dashboard" replace />;
  if (role === 'PharmacyStaff') return <Navigate to="/pharmacy-dashboard" replace />;
  if (role === 'Admin') return <Navigate to="/admin-dashboard" replace />;

  return <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleProtectedRoute allowedRoles={['Patient']} />}>
          <Route path="/patient-dashboard" element={<PatientDashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
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
