import pharmacyApi from './pharmacyApi';

export const prescriptionApi = {
  upload: (formData) => pharmacyApi.post('/prescriptions', formData),
  list: () => pharmacyApi.get('/prescriptions'),
  getFileUrl: (id) => `/prescriptions/${id}/file`,
};
