import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return '';
  const raw = role.trim().toLowerCase();

  if (raw === 'patient' || raw === 'user') return 'Patient';
  if (raw === 'doctor') return 'Doctor';
  if (raw === 'admin') return 'Admin';
  if (raw === 'pharmacystaff' || raw === 'pharmacy staff') return 'PharmacyStaff';

  return role;
};

const RoleProtectedRoute = ({ allowedRoles = [] }) => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-wrapper">
        <div style={{ color: 'var(--text-muted)' }}>Validating permissions...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = normalizeRole(role);
  const allowedNormalized = allowedRoles.map((nextRole) => normalizeRole(nextRole));

  if (allowedNormalized.length > 0 && !allowedNormalized.includes(normalizedRole)) {
    return <Navigate to="/forbidden" replace state={{ message: 'You do not have permission to access this page.' }} />;
  }

  return <Outlet />;
};

export default RoleProtectedRoute;
