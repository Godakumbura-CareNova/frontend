import pharmacyApi from './pharmacyApi';

export const medicineApi = {
  list: () => pharmacyApi.get('/staff/medicines?includeInactive=true'),
  create: (payload) => pharmacyApi.post('/staff/medicines', payload),
  update: (id, payload) => pharmacyApi.put(`/staff/medicines/${id}`, payload),
  deactivate: (id) => pharmacyApi.patch(`/staff/medicines/${id}/deactivate`),
  uploadImage: (id, image) => {
    const formData = new FormData();
    formData.append('image', image);
    return pharmacyApi.post(`/staff/medicines/${id}/image`, formData);
  },
};
