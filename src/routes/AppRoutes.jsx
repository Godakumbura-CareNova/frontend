import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Public Authentication Pages
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';

// Protected Pages
import ProfilePage from '../pages/ProfilePage';
import PatientDashboard from '../pages/PatientDashboard';
import PharmacyStaffDashboard from '../pages/PharmacyStaffDashboard';
import DoctorDashboard from '../pages/DoctorDashboard';
import AdminDashboard from '../pages/AdminDashboard';
import UserManagementPage from '../pages/UserManagementPage';

// Guards
import ProtectedRoute from '../components/ProtectedRoute';
import RoleProtectedRoute from '../components/RoleProtectedRoute';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Authenticated User Common Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Patient Routes */}
      <Route element={<RoleProtectedRoute allowedRoles={['Patient']} />}>
        <Route path="/patient-dashboard" element={<PatientDashboard />} />
      </Route>

      {/* Doctor Routes */}
      <Route element={<RoleProtectedRoute allowedRoles={['Doctor']} />}>
        <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
      </Route>

      {/* Pharmacy Staff Routes */}
      <Route element={<RoleProtectedRoute allowedRoles={['PharmacyStaff']} />}>
        <Route path="/pharmacy-dashboard" element={<PharmacyStaffDashboard />} />
      </Route>

      {/* Admin Routes */}
      <Route element={<RoleProtectedRoute allowedRoles={['Admin']} />}>
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagementPage />} />
      </Route>

      {/* Default Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
