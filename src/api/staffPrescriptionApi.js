import pharmacyApi from './pharmacyApi';

export const staffPrescriptionApi = {
  listPending: () => pharmacyApi.get('/staff/prescriptions'),
  download: (id) => pharmacyApi.get(`/staff/prescriptions/${encodeURIComponent(id)}/file`, { responseType: 'blob' }),
  decide: (id, payload) => pharmacyApi.put(`/staff/prescriptions/${encodeURIComponent(id)}/decision`, payload),
};
