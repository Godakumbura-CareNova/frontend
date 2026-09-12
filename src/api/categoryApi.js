import pharmacyApi from './pharmacyApi';

export const categoryApi = {
  list: () => pharmacyApi.get('/staff/categories'),
  create: (payload) => pharmacyApi.post('/staff/categories', payload),
  update: (id, payload) => pharmacyApi.put(`/staff/categories/${id}`, payload),
  remove: (id) => pharmacyApi.delete(`/staff/categories/${id}`),
};
