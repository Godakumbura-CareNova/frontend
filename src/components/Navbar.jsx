import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, User, LogOut, Shield, LayoutDashboard, Users } from 'lucide-react';

const Navbar = () => {
  const { user, isAuthenticated, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getBadgeClass = (userRole) => {
    switch (userRole) {
      case 'Patient': return 'badge-patient';
      case 'Doctor': return 'badge-doctor';
      case 'PharmacyStaff': return 'badge-pharmacy';
      case 'Admin': return 'badge-admin';
      default: return 'badge-patient';
    }
  };

  const getDashboardLink = () => {
    switch (role) {
      case 'Patient': return '/patient-dashboard';
      case 'Doctor': return '/doctor-dashboard';
      case 'PharmacyStaff': return '/pharmacy-dashboard';
      case 'Admin': return '/admin-dashboard';
      default: return '/login';
    }
  };

  return (
    <header style={{
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem' }}>
        <Link to={isAuthenticated ? getDashboardLink() : '/login'} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Activity size={22} color="#0f172a" />
          </div>
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>CareNova</span>
            <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--text-muted)' }}>Healthcare System</span>
          </div>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {isAuthenticated ? (
            <>
              <Link to={getDashboardLink()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>
                <LayoutDashboard size={16} />
                Dashboard
              </Link>

              {role === 'Admin' && (
                <Link to="/admin/users" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>
                  <Users size={16} />
                  User Management
                </Link>
              )}

              <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>
                <User size={16} />
                Profile
              </Link>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '1rem', borderLeft: '1px solid var(--border-color)' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{user?.fullName || user?.email}</div>
                  <span className={`badge ${getBadgeClass(role)}`}>{role}</span>
                </div>
                
                <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }} title="Logout">
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary">Login</Link>
              <Link to="/register" className="btn btn-primary">Register</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
