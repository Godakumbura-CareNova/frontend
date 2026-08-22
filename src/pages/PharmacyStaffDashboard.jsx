import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Pill, PackageCheck, AlertCircle, Clock, CheckCircle } from 'lucide-react';

const PharmacyStaffDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Pharmacy Operations Center</h1>
        <p style={{ color: 'var(--text-muted)' }}>Welcome back, {user?.fullName || 'Pharmacy Staff'}. Prescription queue management.</p>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Pending Orders</span>
            <Clock color="var(--warning)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>14 Orders</h3>
          <p style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>Requires verification & dispatch</p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Fulfilled Today</span>
            <PackageCheck color="var(--success)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>42 Dispensed</h3>
          <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>+12% compared to yesterday</p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Low Stock Alert</span>
            <AlertCircle color="var(--danger)" size={20} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>2 Items</h3>
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>Metformin & Insulin Glargine</p>
        </div>
      </div>

      <div className="glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Prescription Verification Queue</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Patient Name</th>
              <th>Medication</th>
              <th>Prescribing Doctor</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>#RX-8841</td>
              <td>Michael Chang</td>
              <td>Atorvastatin 20mg</td>
              <td>Dr. Sarah Jenkins</td>
              <td><span className="badge badge-pharmacy">Pending Verification</span></td>
              <td>
                <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Verify & Dispense</button>
              </td>
            </tr>
            <tr>
              <td>#RX-8842</td>
              <td>Emily Watson</td>
              <td>Omeprazole 40mg</td>
              <td>Dr. Robert Vance</td>
              <td><span className="badge badge-doctor">Approved</span></td>
              <td>
                <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Verify & Dispense</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PharmacyStaffDashboard;
