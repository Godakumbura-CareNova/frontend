import React, { useEffect, useState } from 'react';
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
  Info,
  Mail,
  Settings,
} from 'lucide-react';
import pharmacyLogo from '../assets/PHARMACY LOGO .jpeg';
import { getFirstName } from '../utils/formatName';
import { combinedPatientNotificationApi } from '../api/combinedPatientNotificationApi';
import { combinedStaffNotificationApi } from '../api/combinedStaffNotificationApi';
import { doctorNotificationApi } from '../api/doctorNotificationApi';

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return '';

  const raw = role.trim().toLowerCase();

  if (raw === 'patient' || raw === 'user') return 'Patient';
  if (raw === 'doctor') return 'Doctor';
  if (raw === 'admin') return 'Admin';

  if (
    raw === 'pharmacystaff' ||
    raw === 'pharmacy staff'
  ) {
    return 'PharmacyStaff';
  }

  return role;
};

const NAV_BY_ROLE = {
  Patient: [
    {
      to: '/patient-dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      enabled: true,
    },
    {
      to: '/patient/orders',
      label: 'Medicine Orders',
      icon: ShoppingBag,
      enabled: true,
    },
    {
      to: '/patient/appointments',
      label: 'Appointments',
      icon: Calendar,
      enabled: true,
    },
    {
      to: '/patient/medicines',
      label: 'Medicines',
      icon: Pill,
      enabled: true,
    },
    {
      to: '/patient/cart',
      label: 'My cart',
      icon: ShoppingCart,
      enabled: true,
    },
    {
      to: '/patient/prescriptions',
      label: 'Prescriptions',
      icon: FileCheck,
      enabled: true,
    },
    {
      to: '/patient/doctors',
      label: 'Doctors',
      icon: Stethoscope,
      enabled: true,
    },
  ],

  PharmacyStaff: [
    {
      to: '/pharmacy-dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      enabled: true,
    },
    {
      to: '/pharmacy/orders',
      label: 'Medicine Orders',
      icon: ShoppingBag,
      enabled: true,
    },
    {
      to: '/pharmacy/prescriptions',
      label: 'Prescriptions',
      icon: FileCheck,
      enabled: true,
    },
    {
      to: '/pharmacy/medicines',
      label: 'Medicines',
      icon: Pill,
      enabled: true,
    },
    {
      to: '/pharmacy/categories',
      label: 'Categories',
      icon: PackageSearch,
      enabled: true,
    },
    {
      to: '/pharmacy/inventory',
      label: 'Inventory',
      icon: PackageSearch,
      enabled: true,
    },
    {
      to: '/pharmacy/payment-transactions',
      label: 'Payments',
      icon: CreditCard,
      enabled: true,
    },
    {
      to: '/pharmacy/payments',
      label: 'Bank Receipts',
      icon: FileCheck,
      enabled: true,
    },
    {
      to: '/pharmacy/appointment-payments',
      label: 'Appointment Payments',
      icon: Calendar,
      enabled: true,
    },
  ],

  Doctor: [
    {
      to: '/doctor-dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      enabled: true,
    },
    {
      to: '/doctor/appointments',
      label: 'Appointments',
      icon: Calendar,
      enabled: true,
    },
  ],

  Admin: [
    {
      to: '/admin-dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      enabled: true,
    },
    {
      to: '/admin/users',
      label: 'Users',
      icon: UsersIcon,
      enabled: true,
    },
    {
      to: '/admin/fee-requests',
      label: 'Fee Requests',
      icon: CreditCard,
      enabled: true,
    },
    {
      to: '/admin/doctors',
      label: 'Doctors',
      icon: Stethoscope,
      enabled: true,
    },
    {
      to: '/admin/medicines',
      label: 'Medicines',
      icon: Pill,
      enabled: true,
    },
    {
      to: '/admin/appointments',
      label: 'Appointments',
      icon: Calendar,
      enabled: true,
    },
    {
      to: '/admin/payments',
      label: 'Payments',
      icon: CreditCard,
      enabled: true,
    },
    {
      to: '/admin/reports',
      label: 'Reports',
      icon: BarChart3,
      enabled: true,
    },
  ],
};

const DashboardLayout = ({ children }) => {
  const { user, role, logout, isAuthenticated } = useAuth();
  const guest = isAuthenticated === false || !role;
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 900);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const patient = normalizeRole(role) === 'Patient';
  const pharmacyStaff = normalizeRole(role) === 'PharmacyStaff';
  const doctor = normalizeRole(role) === 'Doctor';
  const notificationApi = guest ? null : patient ? combinedPatientNotificationApi : pharmacyStaff ? combinedStaffNotificationApi : doctor ? doctorNotificationApi : null;

  const loadNotifications = async () => {
    if (!notificationApi) return;
    try { setNotifications((await notificationApi.list()).data); } catch { setNotifications([]); }
  };
  useEffect(() => { loadNotifications(); }, [role, guest]);
  const openNotifications = () => { setNotificationsOpen(open => !open); if (!notificationsOpen) loadNotifications(); };
  const markRead = async (notification) => {
    if (!notification.isRead) await notificationApi.markRead(notification.id);
    setNotifications(items => items.map(item => item.id === notification.id ? { ...item, isRead: true } : item));
    setNotificationsOpen(false);
    if (patient && notification.relatedEntityType === 'Appointment') {
      navigate(`/patient/appointments/${encodeURIComponent(notification.relatedEntityId)}/payment`);
    }
    // Online payments open the payment transactions, bank transfer notifications the verification page, the rest orders.
    if (pharmacyStaff) {
      navigate(notification.notificationType === 'OnlinePaymentSucceeded' ? '/pharmacy/payment-transactions'
        : notification.source === 'payment' ? '/pharmacy/payments' : '/pharmacy/orders');
    }
  };

  const roleItems = guest ? NAV_BY_ROLE.Patient.filter(item => item.label !== 'Payments').map(item => item.label === 'Dashboard' ? { ...item, to: '/' } : item) : NAV_BY_ROLE[normalizeRole(role)] || [];
  const navItems = [...roleItems,
    { to: '/about', label: 'About Us', icon: Info, enabled: true },
    { to: '/contact', label: 'Contact Us', icon: Mail, enabled: true },
    ...(!guest && normalizeRole(role) === 'Admin' ? [
      { to: '/admin/pharmacy-information', label: 'Manage Pharmacy Information', icon: Settings, enabled: true },
      { to: '/admin/inquiries', label: 'Contact Inquiries', icon: Mail, enabled: true },
    ] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-shell">
      <aside
        className={`dashboard-sidebar${
          sidebarOpen ? '' : ' collapsed'
        }`}
      >
        <div className="sidebar-brand">
          <img
            src={pharmacyLogo}
            alt="CareNova logo"
            className="sidebar-logo"
          />

          <div>
            <div className="sidebar-brand-title">
              Godakumbura CareNova
            </div>

            <div className="sidebar-brand-subtitle">
              Smart ePharmacy and doctor channeling system
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;

            if (!item.enabled) {
              return (
                <span
                  key={item.label}
                  className="sidebar-nav-item disabled"
                >
                  <Icon size={18} />

                  {item.label}

                  <span className="soon-tag">
                    Soon
                  </span>
                </span>
              );
            }

            const isActive =
              location.pathname === item.to;

            return (
              <Link
                key={item.label}
                to={item.to}
                className={`sidebar-nav-item${
                  isActive ? ' active' : ''
                }`}
                onClick={() =>
                  setSidebarOpen(false)
                }
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {!guest && <div className="sidebar-footer">
          <Link to="/profile" className="sidebar-nav-item" onClick={() => setSidebarOpen(false)}>
            <User size={18} /> Profile
          </Link>

          <button
            type="button"
            className="sidebar-nav-item danger"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>}
      </aside>

      <div className="dashboard-area">
        <header className="dashboard-topbar">
          <button
            type="button"
            className="icon-button sidebar-toggle"
            aria-label={
              sidebarOpen
                ? 'Close menu'
                : 'Open menu'
            }
            onClick={() =>
              setSidebarOpen(
                (open) => !open
              )
            }
          >
            {sidebarOpen
              ? <X size={20} />
              : <Menu size={20} />}
          </button>

          <div className="topbar-actions">
            {guest ? <><Link className="btn btn-primary" to="/login">Login</Link><Link className="btn" to="/register">Register</Link></> : <>
            <button type="button" className="icon-button notification-button" aria-label="Notifications" onClick={openNotifications}>
              <Bell size={20} />

              {notificationApi &&
                notifications.filter(
                  (item) => !item.isRead
                ).length > 0 && (
                  <span className="notification-count">
                    {
                      notifications.filter(
                        (item) => !item.isRead
                      ).length
                    }
                  </span>
                )}
            </button>

            {notificationApi &&
              notificationsOpen && (
                <section
                  className="notification-menu"
                  aria-label="Notifications"
                >
                  <div className="notification-menu-heading">
                    <strong>
                      Notifications
                    </strong>

                    <div className="notification-menu-actions">
                      {notifications.some(
                        (item) => !item.isRead
                      ) && (
                        <button
                          type="button"
                          onClick={async () => {
                            await notificationApi.markAllRead();

                            setNotifications(
                              (items) =>
                                items.map(
                                  (item) => ({
                                    ...item,
                                    isRead: true,
                                  })
                                )
                            );
                          }}
                        >
                          Mark all read
                        </button>
                      )}

                      <button
                        type="button"
                        className="notification-close"
                        aria-label="Close notifications"
                        onClick={() =>
                          setNotificationsOpen(
                            false
                          )
                        }
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {notifications.length === 0 ? (
                    <p className="notification-empty">
                      No notifications yet.
                    </p>
                  ) : (
                    notifications.map(
                      (item) => (
                        <button
                          className={`notification-item${
                            item.isRead
                              ? ''
                              : ' unread'
                          }${
                            [
                              'PaymentRejected',
                              'OnlinePaymentFailed',
                            ].includes(
                              item.orderStatus
                            )
                              ? ' rejected'
                              : ''
                          }`}
                          key={item.id}
                          onClick={() =>
                            markRead(item)
                          }
                        >
                          <strong>
                            {item.title}
                          </strong>

                          <span>
                            {item.message}
                          </span>
                        </button>
                      )
                    )
                  )}
                </section>
              )}

            {normalizeRole(role) ===
              'Patient' && (
              <button
                type="button"
                className="icon-button"
                aria-label="My cart"
                onClick={() =>
                  navigate('/patient/cart')
                }
              >
                <ShoppingCart size={20} />
              </button>
            )}

            <button
              type="button"
              className="user-menu"
              onClick={() =>
                navigate('/profile')
              }
              title="View profile"
            >
              <div className="user-avatar">
                <User size={18} />
              </div>

              <div className="user-menu-text">
                <div className="user-menu-name">
                  {getFirstName(
                    user?.fullName
                  ) || 'User'}
                </div>

                <div className="user-menu-role">
                  {normalizeRole(role)}
                </div>
              </div>

              <ChevronDown
                size={16}
                color="var(--text-muted)"
              />
            </button>
            </>}
          </div>
        </header>

        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
