import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Calendar, FilePlus, Search, UserCheck } from 'lucide-react';

const DoctorDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Physician Clinical Portal</h1>
          <p style={{ color: 'var(--text-muted)' }}>Welcome back, Dr. {user?.fullName || 'Doctor'}. Your daily schedule & patient queue.</p>
        </div>
        <button className="btn btn-primary">
          <FilePlus size={18} /> Create Digital Prescription
        </button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Today's Consultations</span>
            <Calendar color="var(--primary)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>8 Patients</h3>
          <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>3 Completed / 5 Remaining</p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Assigned Patients</span>
            <Users color="var(--accent)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>142 Total</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active care management</p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Pending Lab Reviews</span>
            <UserCheck color="var(--warning)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>4 Reports</h3>
          <p style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>Requires doctor sign-off</p>
        </div>
      </div>

      <div className="glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Today's Patient Schedule</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Time Slot</th>
              <th>Patient Name</th>
              <th>Reason for Visit</th>
              <th>Type</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>09:00 AM</td>
              <td>Eleanor Vance</td>
              <td>Hypertension Follow-up</td>
              <td>In-Person</td>
              <td><span className="badge badge-patient">Completed</span></td>
              <td><button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>View EHR</button></td>
            </tr>
            <tr>
              <td>11:30 AM</td>
              <td>David Miller</td>
              <td>Annual Physical Checkup</td>
              <td>In-Person</td>
              <td><span className="badge badge-doctor">Checked In</span></td>
              <td><button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Start Consultation</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DoctorDashboard;
