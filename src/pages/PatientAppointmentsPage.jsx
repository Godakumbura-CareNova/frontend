import React from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import usePatientAppointments from '../hooks/usePatientAppointments';
import ReceiptRejectionNotice from '../components/appointments/ReceiptRejectionNotice';
import { AppointmentInformation, AppointmentNotice, AppointmentStatus } from './appointmentPresentation';
import './patientOrders.css';
import './patientAppointments.css';

const sections = [ ['Upcoming', 'Upcoming appointments'], ['Previous', 'Previous appointments'], ['Unavailable', 'Appointments needing an update'] ];

export default function PatientAppointmentsPage() {
  const { data, error, busy, refresh } = usePatientAppointments();
  return <DashboardLayout><section className="orders-page orders-list-page patient-appointments">
    <header className="orders-list-header"><span className="orders-list-icon"><CalendarDays size={28} aria-hidden="true" /></span><div><h1>My appointments</h1><p>Keep track of your consultations and appointment history.</p></div><button className="orders-refresh" onClick={refresh} disabled={busy}><RefreshCw size={16} aria-hidden="true" />Refresh appointments</button></header>
    {error && <div role="alert" className="order-error">{error}{data && <p>Showing the last loaded information.</p>}<button onClick={refresh} disabled={busy}>Retry</button></div>}
    {busy && !data && <p className="order-loading">Loading appointments...</p>}
    {data?.length === 0 && <div className="orders-empty"><CalendarDays size={36} aria-hidden="true" /><h2>No appointments yet</h2><p>Your booked consultations will appear here.</p><Link to="/patient/doctors">Browse doctors</Link></div>}
    {!!data?.length && sections.map(([key, title]) => {
      const items = data.filter(item => (['Upcoming', 'Previous'].includes(item.section) ? item.section : 'Unavailable') === key)
        .sort((a, b) => key === 'Previous' ? new Date(b.appointmentStartUtc) - new Date(a.appointmentStartUtc) : new Date(a.appointmentStartUtc) - new Date(b.appointmentStartUtc));
      if (key === 'Unavailable' && !items.length) return null;
      return <section className="orders-history" aria-labelledby={`appointments-${key}`} key={key}>
        <div className="orders-history-heading"><h2 id={`appointments-${key}`}>{title}</h2><span>{items.length} {items.length === 1 ? 'appointment' : 'appointments'}</span></div>
        {!items.length && <p className="order-loading">{key === 'Upcoming' ? 'No upcoming appointments.' : 'No previous appointments.'}</p>}
        {items.map(appointment => <article className="order-card order-details-summary" key={appointment.id}>
          <div className="order-summary-top"><Link className="appointment-reference" to={`/patient/appointments/${appointment.id}`} aria-label={`View details for ${appointment.appointmentReference}`}>{appointment.appointmentReference}</Link><AppointmentStatus status={appointment.status} /></div>
          <AppointmentInformation appointment={appointment} /><AppointmentNotice appointment={appointment} />
          <ReceiptRejectionNotice payment={appointment} reuploadTo={appointment.canPay && !error ? `/patient/appointments/${appointment.id}/payment` : null} />
        </article>)}
      </section>;
    })}
  </section></DashboardLayout>;
}
