import axios from 'axios';
const baseURL = import.meta.env.VITE_PUBLIC_API_BASE_URL || import.meta.env.VITE_APPOINTMENT_API_BASE_URL || 'http://localhost:5136';
const client = axios.create({ baseURL, timeout: 15000 });
const adminOptions = () => {
  const token = localStorage.getItem('carenova_token');
  return { headers: token ? { Authorization: `Bearer ${token}` } : {} };
};
export const getPharmacyInformation = async (admin = false) => (await client.get(`/api/${admin ? 'admin' : 'public'}/pharmacy-information`, admin ? adminOptions() : {})).data;
export const savePharmacyInformation = async data => (await client.put('/api/admin/pharmacy-information', data, adminOptions())).data;
export const submitInquiry = async data => (await client.post('/api/public/contact-inquiries', data)).data;
export const uploadPharmacyImage = async file => {
  const form = new FormData(); form.append('file', file);
  return (await client.post('/api/admin/pharmacy-information/images', form, adminOptions())).data;
};
export const listContactInquiries = async (page = 1, pageSize = 20) => (await client.get('/api/admin/contact-inquiries', { ...adminOptions(), params: { page, pageSize } })).data;
export const markInquiryReviewed = async id => (await client.patch(`/api/admin/contact-inquiries/${encodeURIComponent(id)}/reviewed`, null, adminOptions())).data;
export const pharmacyImageUrl = path => new URL(path, baseURL).href;
