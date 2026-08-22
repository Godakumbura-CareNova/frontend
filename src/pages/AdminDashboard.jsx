import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Users, Server, Activity, UserPlus, FileSpreadsheet } from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>System Administration</h1>
          <p style={{ color: 'var(--text-muted)' }}>Welcome back, System Admin {user?.fullName}. Platform metrics & user governance.</p>
        </div>
        <Link to="/admin/users" className="btn btn-primary">
          <Users size={18} /> Manage All Users
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '2rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Users</span>
            <Users color="var(--primary)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>1,284</h3>
          <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>+48 new this week</p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Active Sessions</span>
            <Activity color="var(--success)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>186</h3>
          <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Peak usage time</p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>System Status</span>
            <Server color="var(--accent)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>99.98%</h3>
          <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>All microservices operational</p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Security Audit</span>
            <ShieldCheck color="var(--warning)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>0 Alerts</h3>
          <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Compliance verified</p>
        </div>
      </div>

      <div className="glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Recent System Audit Logs</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Role</th>
              <th>Action</th>
              <th>IP Address</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2026-08-22 13:45:12</td>
              <td>admin@carenova.org</td>
              <td><span className="badge badge-admin">Admin</span></td>
              <td>Role change for user ID #204</td>
              <td>192.168.1.45</td>
              <td><span className="badge badge-patient">Success</span></td>
            </tr>
            <tr>
              <td>2026-08-22 13:30:05</td>
              <td>dr.jenkins@carenova.org</td>
              <td><span className="badge badge-doctor">Doctor</span></td>
              <td>EHR Record Access</td>
              <td>192.168.1.88</td>
              <td><span className="badge badge-patient">Success</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
