import apiClient from '../api/apiClient';
import pharmacyApi from '../api/pharmacyApi';
import { doctorPaymentApi } from '../api/doctorPaymentApi';
import { appointmentApi } from '../api/appointmentApi';
import { validUtcTimestamp as time } from '../utils/validUtcTimestamp';

const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
const count = v => Number.isSafeInteger(v) && v >= 0;
const id = v => Number.isSafeInteger(v) && v > 0;
const text = v => typeof v === 'string' && v.trim().length > 0;
const amount = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const nullableText = v => v === null || text(v);
const rows = (v, valid) => Array.isArray(v) && v.length <= 5 && v.every(valid) && new Set(v.map(r => r.id ?? r.medicineId)).size === v.length;
const counts = (v, total) => object(v) && Object.entries(v).every(([key, n]) => text(key) && count(n)) && Object.values(v).reduce((sum, n) => sum + n, 0) === total;
const order = v => object(v) && id(v.id) && text(v.reference) && time(v.orderDate) && text(v.status) && amount(v.totalAmount);
const stock = v => object(v) && id(v.medicineId) && text(v.medicineName) && count(v.quantity) && count(v.threshold) && v.quantity <= v.threshold;
const appointment = v => object(v) && id(v.id) && text(v.reference) && typeof v.doctorName === 'string' && time(v.startUtc)
  && text(v.status) && nullableText(v.paymentMethod) && nullableText(v.paymentStatus);
const payment = v => object(v) && id(v.id) && id(v.orderId ?? v.appointmentId) && text(v.reference) && amount(v.amount)
  && text(v.method) && text(v.status) && (v.confirmedAtUtc === null || time(v.confirmedAtUtc)) && time(v.updatedAtUtc);
const queue = (v, valid) => object(v) && count(v.totalCount) && rows(v.items, valid) && v.totalCount >= v.items.length;
const financial = v => count(v.totalPayments) && counts(v.statusCounts, v.totalPayments)
  && queue(v.pendingTransfers, payment) && v.pendingTransfers.totalCount <= v.totalPayments && rows(v.recentPayments, payment)
  && v.recentPayments.length <= v.totalPayments && object(v.income) && amount(v.income.todayAmount) && amount(v.income.monthAmount)
  && v.income.monthAmount >= v.income.todayAmount && count(v.income.undatedSuccessfulCount) && amount(v.income.undatedSuccessfulAmount)
  && v.income.undatedSuccessfulCount <= v.totalPayments && v.income.currency === 'LKR' && v.income.timeZone === 'Asia/Colombo' && time(v.income.asOfUtc);

async function get(client, path, valid, options = {}) {
  const response = await client.get(path, { timeout: 15000, ...options });
  if (response.status !== 200 || !object(response.data) || !time(response.data.generatedAtUtc) || !valid(response.data))
    throw new Error('Dashboard information is unavailable. Please retry.');
  return response.data;
}
export const getAdminUserDashboard = () => get(apiClient, '/admin/dashboard/users', v =>
  ['totalUsers', 'patients', 'pharmacyStaff', 'doctors'].every(key => count(v[key])) && v.patients + v.pharmacyStaff + v.doctors <= v.totalUsers,
  // The dashboard hook owns session-aware access errors, including late responses after account changes.
  { handleUnauthorizedLocally: true });
export const getAdminOperationsDashboard = () => get(pharmacyApi, '/admin/dashboard/operations', v => count(v.totalOrders)
  && counts(v.orderStatusCounts, v.totalOrders) && rows(v.recentOrders, order) && v.totalOrders >= v.recentOrders.length && queue(v.lowStock, stock));
export const getAdminAppointmentDashboard = () => get(appointmentApi, '/api/admin/dashboard/appointments', v => count(v.totalAppointments)
  && counts(v.statusCounts, v.totalAppointments) && count(v.todayCount) && v.todayCount <= v.totalAppointments
  && count(v.upcomingCount) && v.upcomingCount <= v.totalAppointments && rows(v.recentAppointments, appointment) && v.totalAppointments >= v.recentAppointments.length);
export const getAdminMedicinePaymentDashboard = () => get(doctorPaymentApi, '/api/admin/dashboard/medicine-payments', financial);
export const getAdminAppointmentPaymentDashboard = () => get(appointmentApi, '/api/admin/dashboard/appointment-payments', financial);
