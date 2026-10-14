import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import {
  ShoppingBag,
  FileCheck,
  Landmark,
  AlertTriangle,
  PackageCheck,
  CalendarDays,
  ClipboardList,
  Boxes,
} from 'lucide-react';
import { getFirstName } from '../utils/formatName';
import { useRoleDashboard } from '../hooks/useRoleDashboard';
import StaffDashboardSections from '../components/dashboard/StaffDashboardSections';
import pharmacistPhoto from '../assets/home-hero-pharmacist.jpg';
import '../styles/pharmacy-dashboard.css';

const todayLabel = () => new Date().toLocaleDateString('en-LK', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Colombo',
});

const PharmacyStaffDashboard = () => {
  const { user } = useAuth();
  const dashboard = useRoleDashboard('PharmacyStaff');
  const operations = dashboard.sections.operations?.data;

  return (
    <DashboardLayout>
      <div className="pharmacy-dashboard">
        <section className="phd-hero">
          <div className="phd-hero-copy">
            <span className="phd-eyebrow">Pharmacy workspace</span>
            <h1>
              Welcome back, <span className="welcome-name">{getFirstName(user?.fullName) || 'Pharmacy Staff'}</span> 👋
            </h1>
            <p>Here's what needs your attention at the pharmacy counter.</p>
            <span className="phd-date"><CalendarDays size={16} aria-hidden="true" /> {todayLabel()}</span>
            <nav className="phd-quick" aria-label="Pharmacy shortcuts">
              <Link to="/pharmacy/orders" className="phd-quick-link phd-quick-red"><ClipboardList size={16} aria-hidden="true" /> Manage orders</Link>
              <Link to="/pharmacy/prescriptions" className="phd-quick-link phd-quick-green"><FileCheck size={16} aria-hidden="true" /> Verify prescriptions</Link>
              <Link to="/pharmacy/inventory" className="phd-quick-link phd-quick-outline"><Boxes size={16} aria-hidden="true" /> Check inventory</Link>
            </nav>
          </div>
          <img className="phd-hero-photo" src={pharmacistPhoto} alt="" aria-hidden="true" />
        </section>

        <h2 className="phd-section-title">Today at a glance</h2>
        <div className="stat-card-grid phd-stats">
          <StatCard to="/pharmacy/orders?status=Pending" icon={ShoppingBag} title="New Medicine Orders" value={operations?.newOrders.totalCount ?? 'Unavailable'} />
          <StatCard to="/pharmacy/prescriptions" icon={FileCheck} title="Awaiting Prescription Verification" value={operations?.pendingPrescriptions.totalCount ?? 'Unavailable'} />
          <StatCard to="/pharmacy/payments" icon={Landmark} title="Medicine Bank Transfers Awaiting Verification" value={dashboard.sections.medicinePayments?.data?.pendingTransfers.totalCount ?? 'Unavailable'} />
          <StatCard to="/pharmacy/appointment-payments?view=verification" icon={Landmark} title="Appointment Bank Transfers Awaiting Verification" value={dashboard.sections.appointmentPayments?.data?.pendingTransfers.totalCount ?? 'Unavailable'} />
          <StatCard to="/pharmacy/inventory?lowStockOnly=true" icon={AlertTriangle} title="Low-Stock Medicines" value={operations?.lowStock.totalCount ?? 'Unavailable'} />
          <StatCard to="/pharmacy/orders?status=ReadyForCollection" icon={PackageCheck} title="Ready for Collection" value={operations?.readyForCollection.totalCount ?? 'Unavailable'} />
        </div>

        <h2 className="phd-section-title">Work queues and income</h2>
        <StaffDashboardSections dashboard={dashboard} />
      </div>
    </DashboardLayout>
  );
};

export default PharmacyStaffDashboard;
