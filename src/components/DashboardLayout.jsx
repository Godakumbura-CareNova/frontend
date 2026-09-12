import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingBag,
  ShoppingCart,
  Calendar,
  CreditCard,
  Pill,
  Stethoscope,
  Users as UsersIcon,
  PackageSearch,
  FileCheck,
  BarChart3,
  User,
  LogOut,
  Bell,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import pharmacyLogo from '../assets/PHARMACY LOGO .jpeg';
import { getFirstName } from '../utils/formatName';

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return '';
  const raw = role.trim().toLowerCase();

  if (raw === 'patient' || raw === 'user') return 'Patient';
  if (raw === 'doctor') return 'Doctor';
  if (raw === 'admin') return 'Admin';
  if (raw === 'pharmacystaff' || raw === 'pharmacy staff') return 'PharmacyStaff';

  return role;
};

const NAV_BY_ROLE = {
  Patient: [
    { to: '/patient-dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
    { label: 'Medicine Orders', icon: ShoppingBag, enabled: false },
    { label: 'Appointments', icon: Calendar, enabled: false },
    { label: 'Payments', icon: CreditCard, enabled: false },
    { to: '/patient/medicines', label: 'Medicines', icon: Pill, enabled: true },
    { to: '/patient/cart', label: 'My cart', icon: ShoppingCart, enabled: true },
    { to: '/patient/prescriptions', label: 'Prescriptions', icon: FileCheck, enabled: true },
    { label: 'Doctors', icon: Stethoscope, enabled: false },
  ],
  PharmacyStaff: [
    { to: '/pharmacy-dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
    { label: 'Medicine Orders', icon: ShoppingBag, enabled: false },
    { label: 'Prescriptions', icon: FileCheck, enabled: false },
    { to: '/pharmacy/medicines', label: 'Medicines', icon: Pill, enabled: true },
    { to: '/pharmacy/categories', label: 'Categories', icon: PackageSearch, enabled: true },
    { to: '/pharmacy/inventory', label: 'Inventory', icon: PackageSearch, enabled: true },
    { label: 'Payments', icon: CreditCard, enabled: false },
  ],
  Doctor: [
    { to: '/doctor-dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
    { label: 'Appointments', icon: Calendar, enabled: false },
    { label: 'Patients', icon: UsersIcon, enabled: false },
  ],
  Admin: [
    { to: '/admin-dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
    { to: '/admin/users', label: 'Users', icon: UsersIcon, enabled: true },
    { label: 'Doctors', icon: Stethoscope, enabled: false },
    { label: 'Medicines', icon: Pill, enabled: false },
    { label: 'Appointments', icon: Calendar, enabled: false },
    { label: 'Payments', icon: CreditCard, enabled: false },
    { label: 'Reports', icon: BarChart3, enabled: false },
  ],
};

const DashboardLayout = ({ children }) => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = NAV_BY_ROLE[normalizeRole(role)] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-shell">
      <aside className={`dashboard-sidebar${sidebarOpen ? '' : ' collapsed'}`}>
        <div className="sidebar-brand">
          <img src={pharmacyLogo} alt="CareNova logo" className="sidebar-logo" />
          <div>
            <div className="sidebar-brand-title">Godakumbura CareNova</div>
            <div className="sidebar-brand-subtitle">Smart ePharmacy and doctor channeling system</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (!item.enabled) {
              return (
                <span key={item.label} className="sidebar-nav-item disabled">
                  <Icon size={18} />
                  {item.label}
                  <span className="soon-tag">Soon</span>
                </span>
              );
            }
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`sidebar-nav-item${isActive ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Link to="/profile" className="sidebar-nav-item" onClick={() => setSidebarOpen(false)}>
            <User size={18} /> Profile
          </Link>
          <button type="button" className="sidebar-nav-item danger" onClick={handleLogout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      <div className="dashboard-area">
        <header className="dashboard-topbar">
          <button
            type="button"
            className="icon-button sidebar-toggle"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="topbar-actions">
            <button type="button" className="icon-button" aria-label="Notifications">
              <Bell size={20} />
            </button>
            <button
              type="button"
              className="user-menu"
              onClick={() => navigate('/profile')}
              title="View profile"
            >
              <div className="user-avatar">
                <User size={18} />
              </div>
              <div className="user-menu-text">
                <div className="user-menu-name">{getFirstName(user?.fullName) || 'User'}</div>
                <div className="user-menu-role">{normalizeRole(role)}</div>
              </div>
              <ChevronDown size={16} color="var(--text-muted)" />
            </button>
          </div>
        </header>

        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
