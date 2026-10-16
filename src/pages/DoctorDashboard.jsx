import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import { Calendar, CalendarClock, CalendarDays, Users, CheckCircle2, Stethoscope, RefreshCw, Phone, UserRound, Clock3, CreditCard } from 'lucide-react';
import { getFirstName } from '../utils/formatName';
import useDoctorAppointments from '../hooks/useDoctorAppointments';
import { DoctorAppointmentFeedback, doctorAppointmentDate } from './doctorAppointmentPresentation';
import { AppointmentStatus, paymentMethodLabel, paymentStatusLabel } from './appointmentPresentation';
import doctorPhoto from '../assets/home-why-doctor.jpg';
import './patientOrders.css';
import './patientAppointments.css';
import '../styles/doctor-dashboard.css';

function AppointmentRow({ appointment }) {
  const date = new Date(appointment.appointmentStartUtc);
  const validDate = appointment.appointmentStartUtc && Number.isFinite(date.getTime()) && date.getUTCFullYear() > 1;
  const paymentTone = ['Paid', 'Successful'].includes(appointment.paymentStatus) ? 'success' : ['Failed', 'ReceiptRejected', 'Rejected'].includes(appointment.paymentStatus) ? 'danger' : appointment.paymentStatus == null || appointment.paymentStatus === 'Unavailable' ? 'neutral' : 'pending';
  return <article className="dd-appointment-row">
    <div className="dd-date-tile" aria-hidden="true"><strong>{validDate ? date.toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo', day: '2-digit' }) : '-'}</strong><span>{validDate ? date.toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo', month: 'short' }) : 'Date'}</span></div>
    <div className="dd-patient"><Link aria-label={`View details for ${appointment.appointmentReference}`} to={`/doctor/appointments/${appointment.id}`}>{appointment.appointmentReference}</Link>
      <span><UserRound size={14} aria-hidden="true" />{appointment.patientName || 'Patient name unavailable'}</span><span><Phone size={14} aria-hidden="true" />{appointment.patientPhone || 'Phone number unavailable'}</span>
    </div>
    <div className="dd-time"><span className="dd-sr-only">Appointment date</span><span className="dd-row-date">{doctorAppointmentDate(appointment.appointmentStartUtc)}</span><span className="dd-sr-only">Appointment time</span><span><Clock3 size={14} aria-hidden="true" />{doctorAppointmentDate(appointment.appointmentStartUtc, true)} - {doctorAppointmentDate(appointment.appointmentEndUtc, true)}</span><small>Sri Lanka time</small><span><CreditCard size={14} aria-hidden="true" />{paymentMethodLabel(appointment.paymentMethod)}</span></div>
    <div className="dd-row-status"><AppointmentStatus status={appointment.status} /><span className={`dd-payment dd-payment-${paymentTone}`}>{paymentStatusLabel(appointment.paymentStatus)}</span></div>
    {(appointment.status === 'Unavailable' || appointment.paymentStatus === 'Unavailable' || appointment.paymentMethod === 'Unavailable') && <p className="dd-row-notice">Some appointment or payment information is unavailable. Refresh to check for an update.</p>}
  </article>;
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { data, error, busy, refresh } = useDoctorAppointments();
  const renderSection = (view, title, flag, empty, linkText) => {
    const appointments = data.appointments.filter(item => item[flag]);
    if (view === 'completed') appointments.reverse();
    const preview = appointments.slice(0, 5);
    const Icon = view === 'completed' ? CheckCircle2 : Calendar;
    return <section className={`dd-panel dd-panel-${view}`} aria-label={title}>
      <div className="dd-panel-heading"><span className="dd-heading-icon"><Icon size={21} aria-hidden="true" /></span><h2>{title}</h2>{view === 'upcoming' && <button className="dd-refresh" type="button" onClick={refresh} disabled={busy}><RefreshCw size={15} aria-hidden="true" />Refresh appointments</button>}</div>
      <div className="dd-list-heading">{preview.length > 0 && <p>Showing {preview.length} of {data.statistics[view]} appointments</p>}<Link to={`/doctor/appointments?view=${view}`}>{linkText}</Link></div>
      {preview.length ? <div className="dd-appointment-list">{preview.map(item => <AppointmentRow key={item.id} appointment={item} />)}</div> : <div className={`dd-empty dd-empty-${view}`}><Icon size={view === 'today' ? 54 : 28} aria-hidden="true" /><p>{empty}</p>{view === 'today' && <small>Your schedule is clear for today.</small>}</div>}
    </section>;
  };
  return <DashboardLayout><div className="doctor-dashboard patient-appointments">
    <header className="dd-hero"><div className="dd-hero-copy"><span className="dd-eyebrow">Doctor workspace</span><h1>Welcome back, <span>Dr. {getFirstName(user?.fullName) || 'Doctor'}</span></h1><p>Your schedule and patient queue in one place.</p><span className="dd-today"><CalendarDays size={16} aria-hidden="true" />{new Date().toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} - Sri Lanka time</span><nav aria-label="Doctor shortcuts"><Link className="dd-primary" to="/doctor/appointments"><CalendarDays size={18} aria-hidden="true" />View appointments</Link><Link className="dd-outline" to="/profile"><Stethoscope size={18} aria-hidden="true" />Professional Profile</Link></nav></div><img src={doctorPhoto} className="dd-hero-photo" alt="" aria-hidden="true" /></header>
    <div className="stat-card-grid dd-stats">
      <StatCard to="/doctor/appointments?view=today" icon={Calendar} title="Today's Appointments" value={data?.statistics.today ?? 'Unavailable'} />
      <StatCard to="/doctor/appointments?view=upcoming" icon={CalendarClock} title="Upcoming Appointments" value={data?.statistics.upcoming ?? 'Unavailable'} />
      <StatCard to="/doctor/appointments" icon={Users} title="Patient Count" value={data?.statistics.patientCount ?? 'Unavailable'} />
      <StatCard to="/doctor/appointments?view=completed" icon={CheckCircle2} title="Completed Appointments" value={data?.statistics.completed ?? 'Unavailable'} />
    </div>
    <DoctorAppointmentFeedback data={data ? { ...data, contactsUnavailable: false } : data} {...{ error, busy, refresh }} />
    {data && <>
      <div className="dd-workspace">{renderSection('upcoming', 'Upcoming appointments', 'isUpcoming', 'No upcoming appointments.', 'View all upcoming appointments')}
        {renderSection('today', "Today's appointments", 'isToday', 'No scheduled appointments today.', "View today's appointments")}
      </div>
      {renderSection('completed', 'Completed appointments', 'isCompleted', 'No completed appointments yet.', 'View all completed appointments')}
    </>}
  </div></DashboardLayout>;
}
