import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // Redirect to respective user role default dashboard if unauthorized for this specific page
    const fallbackRoute = 
      role === 'Patient' ? '/patient-dashboard' :
      role === 'Doctor' ? '/doctor-dashboard' :
      role === 'PharmacyStaff' ? '/pharmacy-dashboard' :
      role === 'Admin' ? '/admin-dashboard' : '/login';

    return <Navigate to={fallbackRoute} replace />;
  }

  return <Outlet />;
};

export default RoleProtectedRoute;
