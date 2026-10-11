import React from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import {
  ShoppingBag,
  FileCheck,
  Landmark,
  AlertTriangle,
  PackageCheck,
} from 'lucide-react';
import { getFirstName } from '../utils/formatName';
import { useRoleDashboard } from '../hooks/useRoleDashboard';
import StaffDashboardSections from '../components/dashboard/StaffDashboardSections';

const PharmacyStaffDashboard = () => {
  const { user } = useAuth();
  const dashboard = useRoleDashboard('PharmacyStaff');
  const operations = dashboard.sections.operations?.data;

  return (
    <DashboardLayout>
      <div className="welcome-banner">
        <h1>
          Welcome back, <span className="welcome-name">{getFirstName(user?.fullName) || 'Pharmacy Staff'}</span> 👋
        </h1>
        <p>Here's what needs your attention at the pharmacy counter.</p>
      </div>

      <div className="stat-card-grid">
        <StatCard to="/pharmacy/orders?status=Pending" icon={ShoppingBag} title="New Medicine Orders" value={operations?.newOrders.totalCount ?? 'Unavailable'} />
        <StatCard to="/pharmacy/prescriptions" icon={FileCheck} title="Awaiting Prescription Verification" value={operations?.pendingPrescriptions.totalCount ?? 'Unavailable'} />
        <StatCard to="/pharmacy/payments" icon={Landmark} title="Medicine Bank Transfers Awaiting Verification" value={dashboard.sections.medicinePayments?.data?.pendingTransfers.totalCount ?? 'Unavailable'} />
        <StatCard to="/pharmacy/appointment-payments" icon={Landmark} title="Appointment Bank Transfers Awaiting Verification" value={dashboard.sections.appointmentPayments?.data?.pendingTransfers.totalCount ?? 'Unavailable'} />
        <StatCard to="/pharmacy/inventory?lowStockOnly=true" icon={AlertTriangle} title="Low-Stock Medicines" value={operations?.lowStock.totalCount ?? 'Unavailable'} />
        <StatCard to="/pharmacy/orders?status=ReadyForCollection" icon={PackageCheck} title="Ready for Collection" value={operations?.readyForCollection.totalCount ?? 'Unavailable'} />
      </div>

      <StaffDashboardSections dashboard={dashboard} />
    </DashboardLayout>
  );
};

export default PharmacyStaffDashboard;
