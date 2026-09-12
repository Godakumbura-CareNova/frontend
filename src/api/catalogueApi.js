import pharmacyApi from './pharmacyApi';

export const catalogueApi = {
  listMedicines: ({ search = '', categoryId = '', page = 1 }) => pharmacyApi.get('/catalogue/medicines', { params: { search, categoryId: categoryId || undefined, page, pageSize: 12 } }),
  listCategories: () => pharmacyApi.get('/catalogue/categories'),
  getMedicine: (id) => pharmacyApi.get(`/catalogue/medicines/${id}`),
};
