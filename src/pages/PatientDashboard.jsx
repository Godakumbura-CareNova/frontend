import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import { ShoppingBag, Calendar, CreditCard, Pill, Stethoscope, Heart } from 'lucide-react';
import { getFirstName } from '../utils/formatName';

const PatientDashboard = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="welcome-banner">
        <Heart size={72} className="welcome-decoration" />
        <h1>
          Welcome back, <span className="welcome-name">{getFirstName(user?.fullName) || 'Patient'}</span> 👋
        </h1>
        <p>Manage your health easily with CareNova.</p>
      </div>

      <div className="stat-card-grid">
        <StatCard icon={ShoppingBag} title="Recent Medicine Orders" />
        <StatCard icon={Calendar} title="Upcoming Appointments" />
        <StatCard icon={CreditCard} title="Payment Statuses" />
        <StatCard icon={Pill} title="Quick Links" />
      </div>

      <div className="dashboard-section">
        <h2>Quick Links</h2>
        <div className="quicklink-row">
          <Link to="/patient/medicines" className="quicklink-card">
            <div>
              <div className="quicklink-card-title">Medicines</div>
              <div className="quicklink-card-subtitle">Browse and order medicines</div>
            </div>
            <div className="quicklink-card-icon" style={{ background: 'var(--red-soft)', color: 'var(--red-strong)' }}>
              <Pill size={20} />
            </div>
          </Link>
          <Link to="#" className="quicklink-card" onClick={(e) => e.preventDefault()}>
            <div>
              <div className="quicklink-card-title">Doctors</div>
              <div className="quicklink-card-subtitle">Find and book appointments</div>
            </div>
            <div className="quicklink-card-icon" style={{ background: '#ecfdf3', color: 'var(--success)' }}>
              <Stethoscope size={20} />
            </div>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;
