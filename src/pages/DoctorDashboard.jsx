import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import { Calendar, CalendarClock, Users, CheckCircle2, Stethoscope, ChevronRight } from 'lucide-react';
import { getFirstName } from '../utils/formatName';
import useDoctorAppointments from '../hooks/useDoctorAppointments';
import { DoctorAppointmentCard, DoctorAppointmentFeedback } from './doctorAppointmentPresentation';
import './patientOrders.css';
import './patientAppointments.css';
import './doctorAppointments.css';
import '../styles/role-dashboard.css';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const { data, error, busy, refresh } = useDoctorAppointments();
  const sections = [
    { view: 'today', title: "Today's appointments", flag: 'isToday', empty: 'No scheduled appointments today.', linkText: "View today's appointments" },
    { view: 'upcoming', title: 'Upcoming appointments', flag: 'isUpcoming', empty: 'No upcoming appointments.', linkText: 'View all upcoming appointments' },
    { view: 'completed', title: 'Completed appointments', flag: 'isCompleted', empty: 'No completed appointments yet.', linkText: 'View all completed appointments' },
  ];

  return (
    <DashboardLayout>
      <div className="welcome-banner">
        <h1>
          Welcome back, <span className="welcome-name">Dr. {getFirstName(user?.fullName) || 'Doctor'}</span> 👋
        </h1>
        <p>Your schedule and patient queue for today.</p>
      </div>

      <div className="stat-card-grid">
        <StatCard to="/doctor/appointments?view=today" icon={Calendar} title="Today's Appointments" value={data?.statistics.today ?? 'Unavailable'} />
        <StatCard to="/doctor/appointments?view=upcoming" icon={CalendarClock} title="Upcoming Appointments" value={data?.statistics.upcoming ?? 'Unavailable'} />
        <StatCard to="/doctor/appointments" icon={Users} title="Patient Count" value={data?.statistics.patientCount ?? 'Unavailable'} />
        <StatCard to="/doctor/appointments?view=completed" icon={CheckCircle2} title="Completed Appointments" value={data?.statistics.completed ?? 'Unavailable'} />
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

      <div className="dashboard-section orders-page patient-appointments doctor-appointments doctor-dashboard-appointments">
        <p className="order-intro">All consultation times are in Sri Lanka time.</p>
        <button className="orders-refresh" type="button" onClick={refresh} disabled={busy}>Refresh appointments</button>
        <DoctorAppointmentFeedback {...{ data, error, busy, refresh }} />
        {data && sections.map(section => {
          const appointments = data.appointments.filter(item => item[section.flag]);
          if (section.view === 'completed') appointments.reverse();
          const preview = appointments.slice(0, 5);
          return <section key={section.view} aria-label={section.title} className="doctor-dashboard-preview">
            <div className="role-dashboard-heading">
              <h2>{section.title}</h2>
              <Link className="order-back-link" to={`/doctor/appointments?view=${section.view}`}>{section.linkText}</Link>
            </div>
            {preview.length ? <>
              <p className="order-intro">Showing {preview.length} of {data.statistics[section.view]} appointments</p>
              {preview.map(item => <DoctorAppointmentCard key={item.id} appointment={item} />)}
            </> : <p className="empty-state">{section.empty}</p>}
          </section>;
        })}
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
