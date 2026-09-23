import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import { Calendar, CalendarClock, Users, CheckCircle2, Stethoscope, ChevronRight } from 'lucide-react';
import { getFirstName } from '../utils/formatName';

const DoctorDashboard = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="welcome-banner">
        <h1>
          Welcome back, <span className="welcome-name">Dr. {getFirstName(user?.fullName) || 'Doctor'}</span> 👋
        </h1>
        <p>Your schedule and patient queue for today.</p>
      </div>

      <div className="stat-card-grid">
        <StatCard icon={Calendar} title="Today's Appointments" />
        <StatCard icon={CalendarClock} title="Upcoming Appointments" />
        <StatCard icon={Users} title="Patient Count" />
        <StatCard icon={CheckCircle2} title="Completed Appointments" />
      </div>

      <div className="quicklink-row" style={{ marginBottom: '1.5rem' }}>
        <Link to="/profile" className="quicklink-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="quicklink-card-icon" style={{ background: 'var(--red-soft)', color: 'var(--red-strong)' }}>
              <Stethoscope size={20} />
            </span>
            <div>
              <div className="quicklink-card-title">Professional Profile</div>
              <div className="quicklink-card-subtitle">Specialization, fee, availability, qualifications and experience</div>
            </div>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </Link>
      </div>

      <div className="dashboard-section">
        <h2>Appointment Details</h2>
        <p className="empty-state">
          No appointments yet — once the Appointment module is live, each row here will let you mark a visit
          as <strong>Confirmed</strong>, <strong>Completed</strong>, or <strong>No Show</strong>.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
