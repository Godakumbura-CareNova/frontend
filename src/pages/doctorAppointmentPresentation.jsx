import React from 'react';
import { CalendarDays, Clock3, CreditCard, Phone, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppointmentStatus, paymentMethodLabel, paymentStatusLabel } from './appointmentPresentation';

export const doctorStatusLabel = status => status === 'NoShow' ? 'No Show' : status;
export function doctorAppointmentDate(value, time = false) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime()) || date.getUTCFullYear() <= 1) return time ? 'Time unavailable' : 'Date unavailable';
  return new Intl.DateTimeFormat('en-LK', { timeZone: 'Asia/Colombo', ...(time ? { hour: 'numeric', minute: '2-digit' } : { year: 'numeric', month: 'long', day: 'numeric' }) }).format(date);
}
export function DoctorAppointmentInformation({ appointment }) {
  const fields = [
    [UserRound, 'Patient', appointment.patientName || 'Patient name unavailable'],
    [Phone, 'Phone number', appointment.patientPhone || 'Phone number unavailable'],
    [CalendarDays, 'Appointment date', doctorAppointmentDate(appointment.appointmentStartUtc)],
    [Clock3, 'Appointment time', `${doctorAppointmentDate(appointment.appointmentStartUtc, true)} – ${doctorAppointmentDate(appointment.appointmentEndUtc, true)}`],
    [CreditCard, 'Payment method', paymentMethodLabel(appointment.paymentMethod)],
    [CreditCard, 'Payment status', paymentStatusLabel(appointment.paymentStatus)],
  ];
  return <div className="order-meta-grid">{fields.map(([Icon, label, value]) => <div key={label}><Icon size={19} aria-hidden="true" /><div><span>{label}</span><strong>{value}</strong></div></div>)}</div>;
}
export function DoctorAppointmentCard({ appointment }) {
  return <article className="order-card order-details-summary"><div className="order-summary-top"><Link className="appointment-reference" aria-label={`View details for ${appointment.appointmentReference}`} to={`/doctor/appointments/${appointment.id}`}>{appointment.appointmentReference}</Link><AppointmentStatus status={appointment.status} /></div><DoctorAppointmentInformation appointment={appointment} />{(appointment.status === 'Unavailable' || appointment.paymentStatus === 'Unavailable' || appointment.paymentMethod === 'Unavailable') && <p className="appointment-notice">Some appointment or payment information is unavailable. Refresh to check for an update.</p>}</article>;
}
export function DoctorAppointmentFeedback({ error, data, busy, refresh }) {
  return <>{error && <div role="alert" className="order-error">{error}{data && <p>Showing the last loaded information.</p>}<button onClick={refresh} disabled={busy}>Retry</button></div>}{busy && !data && <p className="order-loading">Loading appointments...</p>}{data?.contactsUnavailable && <p role="note" className="doctor-contact-warning">Some patient contact information is unavailable. Refresh to try again.</p>}</>;
}
