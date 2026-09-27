import pharmacyApi from './pharmacyApi';
import { doctorPaymentApi } from './doctorPaymentApi';

export const staffOrderApi = {
  listActive: () => pharmacyApi.get('/staff/orders'),
  // Goes through doctor-payment (GCN-43): it checks the payment, has the pharmacy apply the change, publishes the
  // order-status Kafka event and notifies the patient. An order with no payment record is updated in the pharmacy directly.
  updateStatus: async (id, payload) => {
    try {
      return await doctorPaymentApi.put(`/api/staff/medicine-orders/${encodeURIComponent(id)}/status`, payload);
    } catch (failure) {
      if (failure?.response?.status === 404 && failure.response.data?.code === 'NoPaymentRecord') {
        return pharmacyApi.put(`/staff/orders/${encodeURIComponent(id)}/status`, payload);
      }
      throw failure;
    }
  },
};
