import { appointmentApi } from '../api/appointmentApi';

const validAppointment = (value) => value && Number.isInteger(value.id) && value.id > 0 && typeof value.appointmentReference === 'string';

export const getPatientAppointments = async () => {
  const { data } = await appointmentApi.get('/api/appointments');
  if (!Array.isArray(data) || !data.every(validAppointment)) throw new Error('Invalid appointment response.');
  return data;
};

export const getPatientAppointment = async (appointmentId) => {
  const { data } = await appointmentApi.get(`/api/appointments/${encodeURIComponent(appointmentId)}`);
  if (!validAppointment(data) || String(data.id) !== String(appointmentId)) throw new Error('Invalid appointment response.');
  return data;
};

export const bookAppointment = async ({ doctorId, slotId }) => {
  const response = await appointmentApi.post('/api/appointments', {
    doctorId,
    slotId,
  });

  return response.data;
};
