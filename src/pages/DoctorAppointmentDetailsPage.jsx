import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import useDoctorAppointments from '../hooks/useDoctorAppointments';
import { updateDoctorAppointmentStatus } from '../services/doctorAppointmentService';
import { AppointmentStatus } from './appointmentPresentation';
import { DoctorAppointmentInformation, DoctorAppointmentFeedback, doctorStatusLabel } from './doctorAppointmentPresentation';
import './patientOrders.css';
import './patientAppointments.css';
import './doctorAppointments.css';

export default function DoctorAppointmentDetailsPage() {
  const { appointmentId } = useParams();
  const { data, error, busy, refresh, scope } = useDoctorAppointments(appointmentId);
  const [mutation, setMutation] = useState({ scope, pending: false, error: '', success: '', confirmed: null });
  const active = useRef(scope); active.current = scope;
  useEffect(() => () => { active.current = null; }, []);
  const current = mutation.scope === scope ? mutation : { pending: false, error: '', success: '', confirmed: null };
  const appointment = data && current.confirmed ? { ...data, ...current.confirmed, allowedStatuses: [] } : data;
  const load = async () => { const result = await refresh(); if (result && active.current === scope) setMutation(previous => ({ ...previous, scope, error: '', confirmed: null })); };
  const update = async status => {
    if (!data || current.pending || busy || error) return;
    const snapshot = scope;
    setMutation({ scope, pending: true, error: '', success: '', confirmed: null });
    try {
      const confirmed = await updateDoctorAppointmentStatus(data.id, { status, expectedStatus: data.status, expectedUpdatedAtUtc: data.updatedAtUtc ?? null });
      if (active.current !== snapshot) return;
      setMutation({ scope, pending: true, error: '', success: `Appointment marked ${doctorStatusLabel(status)}.`, confirmed });
      const latest = await refresh();
      if (active.current === snapshot) setMutation(previous => ({ ...previous, pending: false, confirmed: latest ? null : confirmed }));
    } catch (failure) {
      if (active.current !== snapshot) return;
      const code = failure?.response?.status;
      const message = code === 409 ? 'This appointment changed. Refresh it before trying again.' : code === 400 ? 'This status change is not allowed at this time. Refresh the appointment.' : [401, 403, 404].includes(code) ? 'You no longer have access to update this appointment.' : 'Could not confirm the status update. Refresh the appointment before trying again.';
      setMutation({ scope, pending: false, error: message, success: '', confirmed: null });
      if ([401, 403, 404].includes(code)) await refresh();
    }
  };
  return <DashboardLayout><section className="orders-page order-details-page patient-appointments doctor-appointments">
    <Link className="order-back-link" to="/doctor/appointments"><ArrowLeft size={17} />My appointment schedule</Link>
    <DoctorAppointmentFeedback {...{ data, error, busy, refresh: load }} />
    {appointment && <><header className="order-details-header"><p>CONSULTATION DETAILS · SRI LANKA TIME</p><h1>Appointment {appointment.appointmentReference}</h1></header>
      {current.error && <div role="alert" className="order-error">{current.error}<button onClick={load} disabled={busy || current.pending}>Refresh appointment</button></div>}
      {current.success && <p role="status" className="doctor-update-success">{current.success}</p>}
      <section className="order-card order-details-summary"><div className="order-summary-top"><div><span className="order-summary-label">Appointment status</span><AppointmentStatus status={appointment.status} /></div><button className="order-refresh-button" onClick={load} disabled={busy || current.pending}><RefreshCw size={16} />Refresh status</button></div>
        <DoctorAppointmentInformation appointment={appointment} />
        <div className="appointment-actions">{appointment.allowedStatuses.map(status => <button className="doctor-status-action" key={status} disabled={busy || current.pending || !!error || !!current.error} onClick={() => update(status)}>{current.pending ? 'Updating...' : `Mark ${doctorStatusLabel(status)}`}</button>)}</div>
        {appointment.allowedStatuses.length === 0 && <p className="doctor-action-note">No status changes are available for this appointment.</p>}
      </section></>}
  </section></DashboardLayout>;
}
