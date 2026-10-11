import axios from 'axios';
import pharmacyApi from '../api/pharmacyApi';
import { doctorPaymentApi } from '../api/doctorPaymentApi';

const appointmentApi = axios.create({ baseURL: import.meta.env.VITE_APPOINTMENT_API_BASE_URL || 'http://localhost:5136', timeout: 15000 });
appointmentApi.interceptors.request.use(config => {
  const token = localStorage.getItem('carenova_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
const count = v => Number.isSafeInteger(v) && v >= 0;
const id = v => Number.isSafeInteger(v) && v > 0;
const amount = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const text = v => typeof v === 'string' && v.trim().length > 0;
const time = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 19) === v.slice(0, 19);
const rows = (v, valid) => Array.isArray(v) && v.length <= 5 && v.every(valid) && new Set(v.map(r => r.id ?? r.medicineId)).size === v.length;
const order = v => object(v) && id(v.id) && text(v.reference) && time(v.orderDate) && text(v.status) && amount(v.totalAmount);
const payment = v => object(v) && id(v.id) && id(v.orderId ?? v.appointmentId) && text(v.reference) && amount(v.amount) && text(v.method) && text(v.status)
  && (v.confirmedAtUtc === null || time(v.confirmedAtUtc)) && time(v.updatedAtUtc);
const appointment = v => object(v) && id(v.id) && text(v.reference) && text(v.doctorName) && time(v.startUtc) && text(v.status)
  && (v.paymentMethod === null || text(v.paymentMethod)) && (v.paymentStatus === null || text(v.paymentStatus));
const prescription = v => object(v) && id(v.id) && text(v.medicineName) && id(v.quantity) && time(v.uploadedAtUtc) && text(v.status);
const stock = v => object(v) && id(v.medicineId) && text(v.medicineName) && count(v.quantity) && count(v.threshold);
const queue = (v, valid) => object(v) && count(v.totalCount) && rows(v.items, valid) && v.totalCount >= v.items.length;
const statusCounts = v => object(v) && Object.entries(v).every(([key, value]) => text(key) && count(value));
const income = v => object(v) && amount(v.todayAmount) && amount(v.monthAmount) && v.monthAmount >= v.todayAmount && count(v.undatedSuccessfulCount)
  && amount(v.undatedSuccessfulAmount) && v.currency === 'LKR' && v.timeZone === 'Asia/Colombo' && time(v.asOfUtc);
const staffPayments = v => queue(v.pendingTransfers, payment) && rows(v.recentPayments, payment) && income(v.income);

async function get(client, path, valid) {
  const response = await client.get(path, { timeout: 15000 });
  if (response.status !== 200 || !object(response.data) || !time(response.data.generatedAtUtc) || !valid(response.data))
    throw new Error('Dashboard information is unavailable. Please retry.');
  return response.data;
}
export const getPatientOrderDashboard = () => get(pharmacyApi, '/patient/dashboard/orders', v => count(v.totalCount) && rows(v.recentOrders, order) && v.totalCount >= v.recentOrders.length);
export const getPatientMedicinePaymentDashboard = () => get(doctorPaymentApi, '/api/patient/dashboard/medicine-payments', v => statusCounts(v.statusCounts) && rows(v.recentPayments, payment));
export const getStaffOperationsDashboard = () => get(pharmacyApi, '/staff/dashboard/operations', v => queue(v.newOrders, order) && queue(v.readyForCollection, order) && queue(v.pendingPrescriptions, prescription) && queue(v.lowStock, stock));
export const getStaffMedicinePaymentDashboard = () => get(doctorPaymentApi, '/api/staff/dashboard/medicine-payments', staffPayments);
export const getPatientAppointmentDashboard = () => get(appointmentApi, '/api/patient/dashboard/appointments', v => count(v.upcomingCount) && rows(v.appointments, appointment) && v.upcomingCount >= v.appointments.length && statusCounts(v.paymentStatusCounts));
export const getStaffAppointmentPaymentDashboard = () => get(appointmentApi, '/api/staff/dashboard/appointment-payments', staffPayments);
