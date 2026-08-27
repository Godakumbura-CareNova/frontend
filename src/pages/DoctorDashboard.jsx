import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, Calendar, FilePlus, User } from 'lucide-react';

const DoctorDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Doctor Dashboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>Welcome back, Dr. {user?.fullName || 'Doctor'}.</p>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
        <div className="glass-card" style={{ opacity: 0.7 }}>
          <Calendar color="var(--primary)" size={20} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.75rem 0 0.25rem' }}>Appointments</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Coming soon</p>
        </div>

        <div className="glass-card" style={{ opacity: 0.7 }}>
          <Users color="var(--primary)" size={20} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.75rem 0 0.25rem' }}>Patient Records</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Coming soon</p>
        </div>

        <div className="glass-card" style={{ opacity: 0.7 }}>
          <FilePlus color="var(--primary)" size={20} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.75rem 0 0.25rem' }}>Prescriptions</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Coming soon</p>
        </div>
      </div>

      <div className="glass-card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Quick Links</h2>
        <Link to="/profile" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={16} /> View My Profile
        </Link>
      </div>
    </div>
  );
};

export default DoctorDashboard;
