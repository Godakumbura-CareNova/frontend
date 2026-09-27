import { staffNotificationApi } from './staffNotificationApi';
import { listPaymentNotifications, markPaymentNotificationRead } from '../services/paymentService';

const PAYMENT_PREFIX = 'payment-';
const PHARMACY_PREFIX = 'pharmacy-';

/**
 * The pharmacy staff bell: pharmacy-order notifications (new orders, prescriptions) plus the doctor-payment service's
 * bank transfer notifications from its Kafka events (receipt uploaded). Payment ones are marked
 * with source "payment" so the bell opens the verification page for them. Ids are prefixed so each is marked read in
 * the service it came from. Either source failing still shows the other.
 */
export const combinedStaffNotificationApi = {
  list: async () => {
    const [pharmacy, payment] = await Promise.allSettled([staffNotificationApi.list(), listPaymentNotifications()]);
    if (pharmacy.status === 'rejected' && payment.status === 'rejected') throw pharmacy.reason;
    const pharmacyItems = pharmacy.status === 'fulfilled' ? pharmacy.value.data : [];
    const paymentItems = payment.status === 'fulfilled' ? payment.value.data : [];

    const merged = [
      ...paymentItems.map((item) => ({ ...item, id: `${PAYMENT_PREFIX}${item.id}`, source: 'payment' })),
      ...pharmacyItems.map((item) => ({ ...item, id: `${PHARMACY_PREFIX}${item.id}`, source: 'pharmacy' })),
    ];
    return { data: merged.sort((a, b) => new Date(b.createdAtUtc) - new Date(a.createdAtUtc)) };
  },
  markRead: (id) => (String(id).startsWith(PAYMENT_PREFIX)
    ? markPaymentNotificationRead(String(id).slice(PAYMENT_PREFIX.length))
    : staffNotificationApi.markRead(String(id).slice(PHARMACY_PREFIX.length))),
  // The payment service has no "read all", so its unread notifications are marked one by one.
  markAllRead: async () => {
    const unread = (await listPaymentNotifications().catch(() => ({ data: [] }))).data.filter((item) => !item.isRead);
    return Promise.allSettled([staffNotificationApi.markAllRead(), ...unread.map((item) => markPaymentNotificationRead(item.id))]);
  },
};
