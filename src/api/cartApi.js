import pharmacyApi from './pharmacyApi';

export const cartApi = {
  get: () => pharmacyApi.get('/cart'),
  addItem: (payload) => pharmacyApi.post('/cart/items', payload),
  updateItem: (id, payload) => pharmacyApi.put(`/cart/items/${id}`, payload),
  removeItem: (id) => pharmacyApi.delete(`/cart/items/${id}`),
};
