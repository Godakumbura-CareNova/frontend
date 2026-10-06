import { appointmentApi } from '../api/appointmentApi';

export const bookAppointment = async ({ doctorId, slotId }) => {
  const response = await appointmentApi.post('/api/appointments', {
    doctorId,
    slotId,
  });

  return response.data;
};