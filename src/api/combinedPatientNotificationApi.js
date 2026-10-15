import { patientNotificationApi } from './patientNotificationApi';
import { appointmentPatientNotificationApi } from './appointmentPatientNotificationApi';
import {
  listPaymentPatientNotifications, markAllPaymentPatientNotificationsRead, markPaymentPatientNotificationRead,
} from '../services/paymentService';

// Pharmacy-order also notifies order status changes; these titles map its notifications to the status they announce.
const PHARMACY_ORDER_TITLES = {
  'Your order is ready for collection': 'ReadyForCollection',
  'Your order was rejected': 'Rejected',
  'Your order was collected': 'Collected',
};

const PAYMENT_PREFIX = 'payment-';
const PHARMACY_PREFIX = 'pharmacy-';
const APPOINTMENT_PREFIX = 'appointment-';

/**
 * The patient's bell: pharmacy-order notifications (prescriptions, orders) plus the doctor-payment service's
 * order-status notifications from its Kafka events. When both announce the same order status, only the
 * doctor-payment one is shown. Ids are prefixed so each is marked read in the service it came from.
 * Either source failing still shows the other.
 */
export const combinedPatientNotificationApi = {
  list: async () => {
    const [pharmacy, payment, appointment] = await Promise.allSettled([patientNotificationApi.list(), listPaymentPatientNotifications(), appointmentPatientNotificationApi.list()]);
    const pharmacyItems = pharmacy.status === 'fulfilled' ? pharmacy.value.data : [];
    const paymentItems = payment.status === 'fulfilled' ? payment.value.data : [];
    const appointmentItems = appointment.status === 'fulfilled' ? appointment.value.data : [];
    if (pharmacy.status === 'rejected' && payment.status === 'rejected' && appointment.status === 'rejected') throw pharmacy.reason;

    const announced = new Set(paymentItems.map((item) => `${item.orderId}:${item.orderStatus}`));
    const merged = [
      ...appointmentItems.map(item => ({ ...item, id: `${APPOINTMENT_PREFIX}${item.id}` })),
      ...paymentItems.map((item) => ({
        ...item, id: `${PAYMENT_PREFIX}${item.id}`, relatedEntityType: 'Order', relatedEntityId: item.orderId,
      })),
      ...pharmacyItems
        .filter((item) => !(item.relatedEntityType === 'Order'
          && announced.has(`${item.relatedEntityId}:${PHARMACY_ORDER_TITLES[item.title]}`)))
        .map((item) => ({ ...item, id: `${PHARMACY_PREFIX}${item.id}` })),
    ];
    return { data: merged.sort((a, b) => new Date(b.createdAtUtc) - new Date(a.createdAtUtc)) };
  },
  markRead: (id) => (String(id).startsWith(APPOINTMENT_PREFIX)
    ? appointmentPatientNotificationApi.markRead(String(id).slice(APPOINTMENT_PREFIX.length))
    : String(id).startsWith(PAYMENT_PREFIX)
    ? markPaymentPatientNotificationRead(String(id).slice(PAYMENT_PREFIX.length))
    : patientNotificationApi.markRead(String(id).slice(PHARMACY_PREFIX.length))),
  markAllRead: () => Promise.allSettled([patientNotificationApi.markAllRead(), markAllPaymentPatientNotificationsRead(), appointmentPatientNotificationApi.markAllRead()]),
};
