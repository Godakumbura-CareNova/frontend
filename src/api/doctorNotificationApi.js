import { doctorPaymentApi } from './doctorPaymentApi';

// Same shape as the pharmacy notification APIs, so the dashboard bell can use any of them.
export const doctorNotificationApi = {
  list: () => doctorPaymentApi.get('/api/doctors/me/notifications'),
  markRead: (id) => doctorPaymentApi.put(`/api/doctors/me/notifications/${encodeURIComponent(id)}/read`),
  markAllRead: () => doctorPaymentApi.put('/api/doctors/me/notifications/read-all'),
};
