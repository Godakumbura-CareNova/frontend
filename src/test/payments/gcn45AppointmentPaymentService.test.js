import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appointmentApi } from '../../api/appointmentApi';
import * as service from '../../services/appointmentPaymentService';

// GCN-45 QA. The real axios instance and interceptor are used; only the transport adapter is replaced, so no request leaves the test.
let requests; let originalAdapter;
beforeEach(() => {
  requests = []; originalAdapter = appointmentApi.defaults.adapter;
  appointmentApi.defaults.adapter = vi.fn(async (config) => {
    requests.push(config);
    return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config, request: {} };
  });
  localStorage.setItem('carenova_token', 'test-token');
});
afterEach(() => { appointmentApi.defaults.adapter = originalAdapter; localStorage.removeItem('carenova_token'); });

it('V3 sends the right method, URL, bearer token, receipt FormData and staff verification payloads', async () => {
  await service.getAppointmentPayment(7);
  await service.selectAppointmentPaymentMethod(7, 'BankTransfer');
  const file = new File(['%PDF-1.4 test'], 'receipt.pdf', { type: 'application/pdf' });
  await service.uploadAppointmentReceipt(7, file);
  await service.startAppointmentOnlinePayment(7, { firstName: 'Test', email: 'patient@example.test' });
  await service.getAppointmentOnlinePaymentResult(7, 12);
  await service.cancelAppointmentOnlinePayment(7, 12);
  await service.getPendingAppointmentReceipts();
  await service.getAppointmentReceiptFile(5);
  await service.verifyAppointmentReceipt(7, true);
  await service.verifyAppointmentReceipt(7, false, 'Receipt is unreadable');
  await service.getAppointmentPayment('a/b?x=1');

  const call = (i) => requests[i];
  const expected = [
    ['get', '/api/appointments/7/payment'],
    ['post', '/api/appointments/7/payment/method'],
    ['post', '/api/appointments/7/payment/receipt'],
    ['post', '/api/appointments/7/payment/online/start'],
    ['get', '/api/appointments/7/payment/online/12'],
    ['post', '/api/appointments/7/payment/online/12/cancel'],
    ['get', '/api/staff/appointment-payments/receipts'],
    ['get', '/api/staff/appointment-payments/receipts/5/file'],
    ['post', '/api/staff/appointment-payments/appointments/7/receipt/verify'],
    ['post', '/api/staff/appointment-payments/appointments/7/receipt/verify'],
    ['get', '/api/appointments/a%2Fb%3Fx%3D1/payment'],
  ];
  expect(requests).toHaveLength(expected.length);
  expected.forEach(([method, url], i) => { expect([call(i).method, call(i).url]).toEqual([method, url]); });
  requests.forEach((config) => expect(config.headers.Authorization).toBe('Bearer test-token'));

  expect(JSON.parse(call(1).data)).toEqual({ method: 'BankTransfer' });
  expect(call(2).data).toBeInstanceOf(FormData);
  expect(call(2).data.get('receipt')).toBe(file); expect([...call(2).data.keys()]).toEqual(['receipt']);
  expect(JSON.parse(call(3).data)).toEqual({ firstName: 'Test', email: 'patient@example.test' });
  expect(call(7).responseType).toBe('blob');
  expect(JSON.parse(call(8).data)).toEqual({ approved: true, rejectionReason: null });
  expect(JSON.parse(call(9).data)).toEqual({ approved: false, rejectionReason: 'Receipt is unreadable' });

  // Without a stored token no Authorization header is sent.
  localStorage.removeItem('carenova_token'); await service.getAppointmentPayment(7);
  expect(requests.at(-1).headers.Authorization).toBeUndefined();
});
