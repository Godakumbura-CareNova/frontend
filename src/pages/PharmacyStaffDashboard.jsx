import React from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import {
  ShoppingBag,
  FileCheck,
  Landmark,
  AlertTriangle,
  PackageSearch,
  PackageCheck,
  Receipt,
  BarChart3,
} from 'lucide-react';
import { getFirstName } from '../utils/formatName';

const PharmacyStaffDashboard = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="welcome-banner">
        <h1>
          Welcome back, <span className="welcome-name">{getFirstName(user?.fullName) || 'Pharmacy Staff'}</span> 👋
        </h1>
        <p>Here's what needs your attention at the pharmacy counter.</p>
      </div>

      <div className="stat-card-grid">
        <StatCard icon={ShoppingBag} title="New Medicine Orders" />
        <StatCard icon={FileCheck} title="Awaiting Prescription Verification" />
        <StatCard icon={Landmark} title="Bank Transfers Awaiting Verification" />
        <StatCard icon={AlertTriangle} title="Low-Stock Medicines" />
        <StatCard icon={PackageSearch} title="Preparing Orders" />
        <StatCard icon={PackageCheck} title="Ready for Collection" />
        <StatCard icon={Receipt} title="Recent Payments" />
        <StatCard icon={BarChart3} title="Sales Summary" />
      </div>

      <div className="dashboard-section">
        <h2>New Medicine Orders</h2>
        <p className="empty-state">No orders yet — this list fills in once the Medicine Ordering module is live.</p>
      </div>
    </DashboardLayout>
  );
};

export default PharmacyStaffDashboard;
