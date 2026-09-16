import pharmacyApi from './pharmacyApi';

export const prescriptionApi = {
  upload: (formData) => pharmacyApi.post('/prescriptions', formData),
  list: () => pharmacyApi.get('/prescriptions'),
  download: (id) => pharmacyApi.get(`/prescriptions/${id}/file`, { responseType: 'blob' }),
  remove: (id) => pharmacyApi.delete(`/prescriptions/${id}`),
};
