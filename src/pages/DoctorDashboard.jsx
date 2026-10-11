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

const DoctorDashboard = () => {
  const { user } = useAuth();
  const { data, error, busy, refresh } = useDoctorAppointments();

  return (
    <DashboardLayout>
      <div className="welcome-banner">
        <h1>
          Welcome back, <span className="welcome-name">Dr. {getFirstName(user?.fullName) || 'Doctor'}</span> 👋
        </h1>
        <p>Your schedule and patient queue for today.</p>
      </div>

      <div className="stat-card-grid">
        <StatCard icon={Calendar} title="Today's Appointments" value={data?.statistics.today} />
        <StatCard icon={CalendarClock} title="Upcoming Appointments" value={data?.statistics.upcoming} />
        <StatCard icon={Users} title="Patient Count" value={data?.statistics.patientCount} />
        <StatCard icon={CheckCircle2} title="Completed Appointments" value={data?.statistics.completed} />
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

      <div className="dashboard-section orders-page patient-appointments doctor-appointments">
        <h2>Today's appointments</h2>
        <p className="order-intro">All consultation times are in Sri Lanka time.</p>
        <DoctorAppointmentFeedback {...{ data, error, busy, refresh }} />
        <div className="appointment-actions">
          <Link className="order-back-link" to="/doctor/appointments?view=today">View today's appointments</Link>
          <Link className="order-back-link" to="/doctor/appointments?view=upcoming">Upcoming appointments</Link>
          <Link className="order-back-link" to="/doctor/appointments?view=completed">Completed appointments</Link>
        </div>
        {data && !data.appointments.some(item => item.isToday) && <p className="empty-state">No scheduled appointments today.</p>}
        {data?.appointments.filter(item => item.isToday).slice(0, 5).map(item => <DoctorAppointmentCard key={item.id} appointment={item} />)}
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
