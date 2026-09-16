import pharmacyApi from './pharmacyApi';

export const orderApi = {
  review: () => pharmacyApi.get('/orders/review'),
  place: (request) => pharmacyApi.post('/orders', request),
  list: () => pharmacyApi.get('/orders'),
  get: (id) => pharmacyApi.get(`/orders/${encodeURIComponent(id)}`),
};
