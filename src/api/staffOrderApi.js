import pharmacyApi from './pharmacyApi';

export const staffOrderApi = {
  listActive: () => pharmacyApi.get('/staff/orders'),
  updateStatus: (id, payload) => pharmacyApi.put(`/staff/orders/${encodeURIComponent(id)}/status`, payload),
};
