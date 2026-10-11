import React from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import usePatientAppointments from '../hooks/usePatientAppointments';
import { AppointmentInformation, AppointmentNotice, AppointmentStatus } from './appointmentPresentation';
import './patientOrders.css';
import './patientAppointments.css';

export default function PatientAppointmentDetailsPage() {
  const { appointmentId } = useParams();
  const { data: appointment, error, busy, refresh } = usePatientAppointments(appointmentId);
  return <DashboardLayout><section className="orders-page order-details-page patient-appointments">
    <Link className="order-back-link" to="/patient/appointments"><ArrowLeft size={17} />My appointments</Link>
    {error && <div role="alert" className="order-error">{error}{appointment && <p>Showing the last loaded information.</p>}{error !== 'Appointment not found.' && <button onClick={refresh} disabled={busy}>Retry</button>}</div>}
    {busy && !appointment && <p className="order-loading">Loading appointment...</p>}
    {appointment && <>
      <header className="order-details-header"><p>CONSULTATION DETAILS</p><h1>Appointment {appointment.appointmentReference}</h1></header>
      <section className="order-card order-details-summary">
        <div className="order-summary-top"><div><span className="order-summary-label">Appointment status</span><AppointmentStatus status={appointment.status} /></div><button className="order-refresh-button" onClick={refresh} disabled={busy}><RefreshCw size={16} />Refresh status</button></div>
        <AppointmentInformation appointment={appointment} /><AppointmentNotice appointment={appointment} />
        <div className="appointment-actions">
          {appointment.canPay && !error && <Link className="btn btn-green" to={`/patient/appointments/${appointment.id}/payment`}>Continue to Payment</Link>}
          {!appointment.canPay && ['Successful', 'ReceiptUnderVerification'].includes(appointment.paymentStatus) && <Link className="order-back-link" to={`/patient/appointments/${appointment.id}/payment`}>View payment</Link>}
        </div>
      </section>
    </>}
  </section></DashboardLayout>;
}
