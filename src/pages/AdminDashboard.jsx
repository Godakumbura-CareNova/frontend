import React from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import AdminDashboardSections from '../components/dashboard/AdminDashboardSections';
import pharmacistPhoto from '../assets/home-hero-pharmacist.jpg';
import '../styles/admin-dashboard.css';
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
  CalendarDays,
  RefreshCw,
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
      <div className="admin-dashboard">
      <header className="ad-hero">
        <div className="ad-hero-copy"><span className="ad-eyebrow">Administration workspace</span>
        <h1>
          Welcome back, <span className="welcome-name">Admin</span> 👋
        </h1>
        <p>Platform overview and user governance.</p>
        <span className="ad-date"><CalendarDays size={16} aria-hidden="true" />{new Date().toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Colombo' })}</span>
        <nav className="ad-shortcuts" aria-label="Admin shortcuts">
          <Link to="/admin/users" className="ad-shortcut ad-shortcut-red"><Users size={16} aria-hidden="true" />User directory</Link>
          <Link to="/admin/fee-requests" className="ad-shortcut ad-shortcut-green"><HandCoins size={16} aria-hidden="true" />Review fee requests</Link>
          <Link to="/admin/reports" className="ad-shortcut ad-shortcut-outline"><DollarSign size={16} aria-hidden="true" />Financial reports</Link>
        </nav></div>
        <img className="ad-hero-photo" src={pharmacistPhoto} alt="" aria-hidden="true" />
      </header>

      <div className="ad-section-heading"><h2>Platform at a glance</h2><button type="button" className="ad-refresh" onClick={dashboard.refreshAll}><RefreshCw size={16} aria-hidden="true" />Refresh dashboard</button></div>
      <div className="stat-card-grid ad-stats">
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

      <div className="dashboard-section ad-quick-links">
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
      <h2 className="ad-section-title">Platform activity</h2>
      <AdminDashboardSections dashboard={dashboard} />
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
