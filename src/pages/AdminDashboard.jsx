import React from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import {
  Users,
  UserCircle,
  Briefcase,
  Stethoscope,
  ShoppingBag,
  Calendar,
  DollarSign,
  CreditCard,
  AlertTriangle,
  HandCoins,
} from 'lucide-react';

const AdminDashboard = () => {
  return (
    <DashboardLayout>
      <div className="welcome-banner">
        <h1>
          Welcome back, <span className="welcome-name">Admin</span> 👋
        </h1>
        <p>Platform overview and user governance.</p>
      </div>

      <div className="stat-card-grid">
        <StatCard icon={Users} title="Total Users" />
        <StatCard icon={UserCircle} title="Patients" />
        <StatCard icon={Briefcase} title="Pharmacy Staff" />
        <StatCard icon={Stethoscope} title="Doctors" />
        <StatCard icon={ShoppingBag} title="Medicine Orders" />
        <StatCard icon={Calendar} title="Appointments" />
        <StatCard icon={DollarSign} title="Sales Totals" />
        <StatCard icon={CreditCard} title="Payment Summary" />
        <StatCard icon={AlertTriangle} title="Low-Stock Alerts" />
      </div>

      <div className="dashboard-section">
        <h2>Quick Links</h2>
        <div className="quicklink-row">
          <Link to="/admin/users" className="quicklink-card">
            <div>
              <div className="quicklink-card-title">Manage Users</div>
              <div className="quicklink-card-subtitle">View users, change roles, activate or deactivate accounts</div>
            </div>
            <div className="quicklink-card-icon" style={{ background: 'var(--red-soft)', color: 'var(--red-strong)' }}>
              <Users size={20} />
            </div>
          </Link>
          <Link to="/admin/fee-requests" className="quicklink-card">
            <div>
              <div className="quicklink-card-title">Consultation Fee Requests</div>
              <div className="quicklink-card-subtitle">Approve or reject doctors' requested consultation fee changes</div>
            </div>
            <div className="quicklink-card-icon" style={{ background: 'var(--red-soft)', color: 'var(--red-strong)' }}>
              <HandCoins size={20} />
            </div>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
