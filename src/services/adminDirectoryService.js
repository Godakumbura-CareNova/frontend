import apiClient from '../api/apiClient';
import pharmacyApi from '../api/pharmacyApi';
import { appointmentApi } from '../api/appointmentApi';

const options = { timeout: 15000, handleUnauthorizedLocally: true };
const integer = n => Number.isSafeInteger(n) && n >= 0;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const unavailable = () => new Error('List information is unavailable. Please retry.');
async function users() {
  const response = await apiClient.get('/admin/users', options);
  if (response.status !== 200 || !Array.isArray(response.data) || response.data.some(u => !object(u) || typeof u.id !== 'string')) throw unavailable();
  return response.data;
}
async function list(client, path, params) {
  const response = await client.get(path, { ...options, params });
  const data = response.data;
  if (response.status !== 200 || !object(data) || !Array.isArray(data.items) || !integer(data.totalCount) ||
      data.page !== params.page || data.pageSize !== params.pageSize || data.totalPages !== Math.ceil(data.totalCount / params.pageSize) ||
      data.items.length > params.pageSize || data.items.length > data.totalCount ||
      data.items.some(item => !object(item) || !integer(item.id) || item.id === 0) || new Set(data.items.map(item => item.id)).size !== data.items.length) throw unavailable();
  return data;
}
export async function loadAdminDirectory(kind, { search = '', page = 1, pageSize = 20 }) {
  if (kind === 'doctors') {
    const term = search.trim().toLowerCase();
    const doctors = (await users()).filter(u => u.role?.trim().toLowerCase() === 'doctor')
      .filter(u => [u.fullName, u.email, u.mobileNumber].some(value => String(value ?? '').toLowerCase().includes(term)))
      .sort((a, b) => String(a.fullName ?? '').localeCompare(String(b.fullName ?? '')) || a.id.localeCompare(b.id));
    return { items: doctors.slice((page - 1) * pageSize, page * pageSize), totalCount: doctors.length,
      totalPages: Math.ceil(doctors.length / pageSize), warning: null };
  }
  const params = { search, page, pageSize };
  if (kind === 'medicines') return list(pharmacyApi, '/admin/medicines', params);
  if (kind !== 'appointments') throw unavailable();
  const data = await list(appointmentApi, '/api/admin/appointments', params);
  if (!data.items.length) return { ...data, warning: null };
  let names = new Map();
  try { names = new Map((await users()).map(u => [u.id.toLowerCase(), u.fullName])); }
  catch (error) { if ([401, 403].includes(error?.response?.status)) throw error; }
  const items = data.items.map(a => ({ ...a, patientName: names.get(String(a.patientId).toLowerCase()) || 'Patient name unavailable' }));
  return { ...data, items, warning: items.some(a => a.patientName === 'Patient name unavailable')
    ? 'Some patient names are unavailable. Appointment information is still shown; refresh to retry the names.' : null };
}
