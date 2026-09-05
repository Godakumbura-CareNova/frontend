import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Calendar, FileText, Pill, Activity, Clock, LogOut, Plus } from 'lucide-react';

const PatientDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Patient Health Portal</h1>
          <p style={{ color: 'var(--text-muted)' }}>Welcome back, {user?.fullName || 'Patient'}. Here is your healthcare summary.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-primary">
            <Plus size={18} /> Book Appointment
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Upcoming Appointment</span>
            <Calendar color="var(--primary)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>Tomorrow, 10:30 AM</h3>
          <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Dr. Sarah Jenkins (Cardiology)</p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Active Prescriptions</span>
            <Pill color="var(--warning)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>3 Active</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ready for refilling at CareNova Pharmacy</p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Recent Medical Reports</span>
            <FileText color="var(--accent)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>2 New Reports</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Blood Work & Lipid Panel</p>
        </div>
      </div>

      {/* Active Prescriptions Table */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Active Prescriptions</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dosage</th>
              <th>Doctor</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Amoxicillin 500mg</td>
              <td>1 tablet / 8 hours</td>
              <td>Dr. Sarah Jenkins</td>
              <td><span className="badge badge-pharmacy">Ready for Pickup</span></td>
              <td><button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Request Refill</button></td>
            </tr>
            <tr>
              <td>Lisinopril 10mg</td>
              <td>1 tablet / daily</td>
              <td>Dr. Robert Vance</td>
              <td><span className="badge badge-patient">Active</span></td>
              <td><button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Request Refill</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PatientDashboard;
