import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Users, Server, User } from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Admin Dashboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>Welcome back, {user?.fullName || 'Admin'}.</p>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
        <div className="glass-card" style={{ opacity: 0.7 }}>
          <Server color="var(--primary)" size={20} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.75rem 0 0.25rem' }}>System Metrics</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Coming soon</p>
        </div>

        <div className="glass-card" style={{ opacity: 0.7 }}>
          <ShieldCheck color="var(--primary)" size={20} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.75rem 0 0.25rem' }}>Audit Logs</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Coming soon</p>
        </div>

        <div className="glass-card" style={{ opacity: 0.7 }}>
          <Users color="var(--primary)" size={20} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.75rem 0 0.25rem' }}>Reports</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Coming soon</p>
        </div>
      </div>

      <div className="glass-card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Quick Links</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/admin/users" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={16} /> Manage Users
          </Link>
          <Link to="/profile" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={16} /> View My Profile
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
