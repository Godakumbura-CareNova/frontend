import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const getDashboardRouteByRole = (role) => {
  if (role === 'Patient') return '/patient-dashboard';
  if (role === 'Doctor') return '/doctor-dashboard';
  if (role === 'PharmacyStaff' || role === 'Pharmacy Staff') return '/pharmacy-dashboard';
  if (role === 'Admin') return '/admin-dashboard';
  return '/login';
};

const ForbiddenPage = () => {
  const { role, isAuthenticated } = useAuth();
  const location = useLocation();

  const message = location.state?.message || 'You are authenticated, but you are not authorized to access this resource.';

  return (
    <div className="auth-wrapper">
      <div className="glass-card auth-card">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            padding: '0.75rem',
            borderRadius: '1rem',
            background: 'rgba(211, 39, 31, 0.1)',
            marginBottom: '1rem'
          }}>
            <ShieldAlert size={30} color="var(--danger)" />
          </div>

          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.5rem' }}>403 Forbidden</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{message}</p>

          <Link className="btn btn-primary" to={isAuthenticated ? getDashboardRouteByRole(role) : '/login'}>
            <ArrowLeft size={16} /> Go Back
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForbiddenPage;
