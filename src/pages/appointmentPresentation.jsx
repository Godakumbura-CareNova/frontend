import React from 'react';
import { CalendarDays, Clock3, CreditCard, Stethoscope } from 'lucide-react';
import { hasRejectedReceipt } from '../components/appointments/ReceiptRejectionNotice';

const methods = { Cash: 'Cash', BankTransfer: 'Bank transfer', PaymentGateway: 'Online payment' };
const paymentStatuses = { Pending: 'Pending', AwaitingBankTransferReceipt: 'Awaiting bank transfer receipt', ReceiptUnderVerification: 'Receipt under verification', AwaitingGatewayPayment: 'Awaiting online payment', Successful: 'Successful', Failed: 'Failed' };
const statuses = { Booked: 'Booked', Confirmed: 'Confirmed', Completed: 'Completed', Cancelled: 'Cancelled', NoShow: 'No Show' };
export const paymentMethodLabel = value => value == null ? 'Not selected' : methods[value] || 'Unavailable';
export const paymentStatusLabel = value => value == null ? 'Not paid' : paymentStatuses[value] || 'Unavailable';
export function appointmentDate(value, time = false) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime()) || date.getUTCFullYear() <= 1) return time ? 'Time unavailable' : 'Date unavailable';
  return time ? date.toLocaleTimeString('en-LK', { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
}
export function AppointmentStatus({ status }) {
  const known = Object.hasOwn(statuses, status);
  return <span className={`appointment-status appointment-status-${known ? status : 'Unavailable'}`}>{statuses[status] || 'Unavailable'}</span>;
}
export function AppointmentInformation({ appointment }) {
  const fields = [
    [Stethoscope, 'Doctor', appointment.doctorName || 'Doctor information unavailable'],
    [CalendarDays, 'Appointment date', appointmentDate(appointment.appointmentStartUtc)],
    [Clock3, 'Appointment time', `${appointmentDate(appointment.appointmentStartUtc, true)} – ${appointmentDate(appointment.appointmentEndUtc, true)}`],
    [CreditCard, 'Payment method', paymentMethodLabel(appointment.paymentMethod)],
    [CreditCard, 'Payment status', hasRejectedReceipt(appointment) ? 'Receipt rejected' : paymentStatusLabel(appointment.paymentStatus)],
  ];
  return <div className="order-meta-grid">{fields.map(([Icon, label, value]) => <div key={label}><Icon size={19} aria-hidden="true" /><div><span>{label}</span><strong>{value}</strong></div></div>)}</div>;
}
export function AppointmentNotice({ appointment }) {
  if (appointment.section !== 'Unavailable' && appointment.status !== 'Unavailable' && appointment.paymentStatus !== 'Unavailable' && appointment.paymentMethod !== 'Unavailable') return null;
  return <p role="note" className="appointment-notice">Some appointment or payment status information is unavailable. Refresh to check for an update.</p>;
}
