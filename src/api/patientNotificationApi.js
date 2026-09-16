import pharmacyApi from './pharmacyApi';

export const patientNotificationApi = {
  list: () => pharmacyApi.get('/patient-notifications'),
  markRead: (id) => pharmacyApi.put(`/patient-notifications/${encodeURIComponent(id)}/read`),
  markAllRead: () => pharmacyApi.put('/patient-notifications/read-all'),
};
