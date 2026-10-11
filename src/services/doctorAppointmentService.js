import { appointmentApi } from '../api/appointmentApi';

const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
const validAppointment = value => value && Number.isInteger(value.id) && value.id > 0 && typeof value.appointmentReference === 'string' && typeof value.status === 'string'
  && ['isToday', 'isUpcoming', 'isCompleted', 'isHistory'].every(key => typeof value[key] === 'boolean')
  && Array.isArray(value.allowedStatuses) && value.allowedStatuses.every(status => ['Confirmed', 'Completed', 'NoShow'].includes(status));
export async function getDoctorAppointments() {
  const { data } = await appointmentApi.get('/api/doctor/appointments');
  if (!data || !Array.isArray(data.appointments) || !data.appointments.every(validAppointment) || !['today', 'upcoming', 'completed', 'patientCount'].every(key => Number.isInteger(data.statistics?.[key]) && data.statistics[key] >= 0)) throw new Error('Invalid appointment response.');
  return data;
}
export async function getDoctorAppointment(id) {
  const { data } = await appointmentApi.get(`/api/doctor/appointments/${encodeURIComponent(id)}`);
  if (!validAppointment(data) || String(data.id) !== String(id)) throw new Error('Invalid appointment response.');
  return data;
}
export async function updateDoctorAppointmentStatus(id, request) {
  const { data, status } = await appointmentApi.patch(`/api/doctor/appointments/${encodeURIComponent(id)}/status`, request);
  if (status !== 200 || !data || String(data.id) !== String(id) || data.status !== request.status || !validDate(data.updatedAtUtc)) throw new Error('The API did not confirm this status update. Refresh the appointment before trying again.');
  return data;
}
