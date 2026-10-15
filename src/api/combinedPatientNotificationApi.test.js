import { beforeEach, expect, it, vi } from 'vitest';
import { combinedPatientNotificationApi } from './combinedPatientNotificationApi';
import { patientNotificationApi } from './patientNotificationApi';
import { appointmentPatientNotificationApi } from './appointmentPatientNotificationApi';
import * as payments from '../services/paymentService';
vi.mock('./patientNotificationApi', () => ({ patientNotificationApi: { list:vi.fn(), markRead:vi.fn(), markAllRead:vi.fn() } }));
vi.mock('./appointmentPatientNotificationApi', () => ({ appointmentPatientNotificationApi: { list:vi.fn(), markRead:vi.fn(), markAllRead:vi.fn() } }));
vi.mock('../services/paymentService', () => ({ listPaymentPatientNotifications:vi.fn(), markPaymentPatientNotificationRead:vi.fn(), markAllPaymentPatientNotificationsRead:vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); patientNotificationApi.list.mockResolvedValue({data:[]}); payments.listPaymentPatientNotifications.mockResolvedValue({data:[]}); appointmentPatientNotificationApi.list.mockResolvedValue({data:[]}); });
it('merges appointment receipts with medicine notifications without confusing matching IDs', async () => {
  appointmentPatientNotificationApi.list.mockResolvedValue({data:[{id:1,relatedEntityType:'Appointment',relatedEntityId:7,createdAtUtc:'2026-10-15T12:00:00Z',isRead:false}]});
  payments.listPaymentPatientNotifications.mockResolvedValue({data:[{id:1,orderId:7,createdAtUtc:'2026-10-14T12:00:00Z',isRead:false}]});
  const {data} = await combinedPatientNotificationApi.list();
  expect(data.map(n=>n.id)).toEqual(['appointment-1','payment-1']);
  expect(data[0].relatedEntityType).toBe('Appointment');
  await combinedPatientNotificationApi.markRead('appointment-1');
  expect(appointmentPatientNotificationApi.markRead).toHaveBeenCalledWith('1');
  expect(payments.markPaymentPatientNotificationRead).not.toHaveBeenCalled();
});
it('retains existing notifications if the appointment service fails', async () => {
  appointmentPatientNotificationApi.list.mockRejectedValue(new Error('Offline'));
  patientNotificationApi.list.mockResolvedValue({data:[{id:2,title:'Prescription reviewed',createdAtUtc:'2026-10-15T12:00:00Z'}]});
  expect((await combinedPatientNotificationApi.list()).data[0].id).toBe('pharmacy-2');
});
it('shows appointment notifications if both medicine sources fail and routes mark-all to every owner', async () => {
  patientNotificationApi.list.mockRejectedValue(new Error('Offline'));
  payments.listPaymentPatientNotifications.mockRejectedValue(new Error('Offline'));
  appointmentPatientNotificationApi.list.mockResolvedValue({data:[{id:3,createdAtUtc:'2026-10-15T12:00:00Z'}]});
  expect((await combinedPatientNotificationApi.list()).data[0].id).toBe('appointment-3');
  await combinedPatientNotificationApi.markAllRead();
  expect(patientNotificationApi.markAllRead).toHaveBeenCalledTimes(1);
  expect(payments.markAllPaymentPatientNotificationsRead).toHaveBeenCalledTimes(1);
  expect(appointmentPatientNotificationApi.markAllRead).toHaveBeenCalledTimes(1);
});
