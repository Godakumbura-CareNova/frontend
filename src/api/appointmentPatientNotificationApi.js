import { appointmentApi } from './appointmentApi';
const path = '/api/patient/appointment-notifications';
export const appointmentPatientNotificationApi = {
  list: () => appointmentApi.get(path, { timeout: 15000 }),
  markRead: id => appointmentApi.post(`${path}/${encodeURIComponent(id)}/read`),
  markAllRead: () => appointmentApi.post(`${path}/read-all`),
};
