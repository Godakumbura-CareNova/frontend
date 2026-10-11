import React from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import useDoctorAppointments from '../hooks/useDoctorAppointments';
import { DoctorAppointmentCard, DoctorAppointmentFeedback } from './doctorAppointmentPresentation';
import './patientOrders.css';
import './patientAppointments.css';
import './doctorAppointments.css';

const views = [['today', 'Today', 'isToday'], ['upcoming', 'Upcoming', 'isUpcoming'], ['completed', 'Completed', 'isCompleted'], ['history', 'History', 'isHistory']];
export default function DoctorAppointmentsPage() {
  const { data, error, busy, refresh } = useDoctorAppointments();
  const [params, setParams] = useSearchParams();
  const view = views.find(([key]) => key === params.get('view')) || views[0];
  const appointments = data?.appointments.filter(item => item[view[2]]) || [];
  if (view[0] === 'completed' || view[0] === 'history') appointments.reverse();
  return <DashboardLayout><section className="orders-page orders-list-page patient-appointments doctor-appointments">
    <header className="orders-list-header"><span className="orders-list-icon"><CalendarDays size={28} aria-hidden="true" /></span><div><h1>My appointment schedule</h1><p>Manage your consultations. All times are in Sri Lanka time.</p></div><button className="orders-refresh" onClick={refresh} disabled={busy}><RefreshCw size={16} aria-hidden="true" />Refresh appointments</button></header>
    <DoctorAppointmentFeedback {...{ error, data, busy, refresh }} />
    {data && <><p className="doctor-patient-count">Total patients: <strong>{data.statistics.patientCount}</strong></p><div role="tablist" aria-label="Appointment views" className="doctor-appointment-tabs">{views.map(([key, label, flag]) => <button role="tab" id={`doctor-tab-${key}`} aria-controls="doctor-appointment-panel" aria-selected={view[0] === key} key={key} onClick={() => setParams({ view: key })}>{label} ({data.appointments.filter(item => item[flag]).length})</button>)}</div>
      <section role="tabpanel" id="doctor-appointment-panel" aria-labelledby={`doctor-tab-${view[0]}`}>
        {appointments.length === 0 ? <div className="orders-empty"><CalendarDays size={36} aria-hidden="true" /><h2>No scheduled appointments</h2><p>{data.appointments.length === 0 ? 'Your assigned consultations will appear here.' : `No appointments in ${view[1].toLowerCase()}.`}</p></div> : appointments.map(item => <DoctorAppointmentCard key={item.id} appointment={item} />)}
      </section></>}
  </section></DashboardLayout>;
}
