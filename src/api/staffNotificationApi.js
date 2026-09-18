import pharmacyApi from './pharmacyApi';

export const staffNotificationApi = {
  list: () => pharmacyApi.get('/staff/notifications'),
  markRead: (id) => pharmacyApi.put(`/staff/notifications/${encodeURIComponent(id)}/read`),
  markAllRead: () => pharmacyApi.put('/staff/notifications/read-all'),
};
