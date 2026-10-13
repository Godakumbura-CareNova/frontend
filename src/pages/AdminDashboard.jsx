import React from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import AdminDashboardSections from '../components/dashboard/AdminDashboardSections';
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
  const dashboard = useAdminDashboard();
  const users = dashboard.sections.users?.data;
  const operations = dashboard.sections.operations?.data;
  const appointments = dashboard.sections.appointments?.data;
  const paymentCount = dashboard.sections.medicinePayments?.data && dashboard.sections.appointmentPayments?.data
    ? dashboard.sections.medicinePayments.data.totalPayments + dashboard.sections.appointmentPayments.data.totalPayments : 'Unavailable';
  return (
    <DashboardLayout>
      <div className="welcome-banner">
        <h1>
          Welcome back, <span className="welcome-name">Admin</span> 👋
        </h1>
        <p>Platform overview and user governance.</p>
      </div>

      <div className="stat-card-grid">
        <StatCard to="/admin/users" icon={Users} title="Total Users" value={users?.totalUsers ?? 'Unavailable'} />
        <StatCard to="/admin/users" icon={UserCircle} title="Patients" value={users?.patients ?? 'Unavailable'} />
        <StatCard to="/admin/users" icon={Briefcase} title="Pharmacy Staff" value={users?.pharmacyStaff ?? 'Unavailable'} />
        <StatCard to="/admin/doctors" icon={Stethoscope} title="Doctors" value={users?.doctors ?? 'Unavailable'} />
        <StatCard to="#admin-orders" icon={ShoppingBag} title="Medicine Orders" value={operations?.totalOrders ?? 'Unavailable'} />
        <StatCard to="/admin/appointments" icon={Calendar} title="Appointments" value={appointments?.totalAppointments ?? 'Unavailable'} />
        <StatCard to="#admin-income" icon={DollarSign} title="Sales Totals" value="See income below" />
        <StatCard to="#admin-payment-summary" icon={CreditCard} title="Payment Summary" value={paymentCount} />
        <StatCard to="#admin-low-stock" icon={AlertTriangle} title="Low-Stock Alerts" value={operations?.lowStock.totalCount ?? 'Unavailable'} />
      </div>

      <button type="button" className="btn btn-primary" onClick={dashboard.refreshAll}>Refresh dashboard</button>

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
      <AdminDashboardSections dashboard={dashboard} />
    </DashboardLayout>
  );
};

export default AdminDashboard;
