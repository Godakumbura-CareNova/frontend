import React, { useEffect, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { loadAdminDirectory } from '../services/adminDirectoryService';
import { money, statusLabel, methodLabel } from '../components/dashboard/DashboardSectionState';

const labels = { doctors: 'Doctors', medicines: 'Medicines', appointments: 'Appointments' };
const text = value => typeof value === 'string' && value.trim() ? value : 'Unavailable';
const dateTime = value => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' }) : 'Unavailable';
const headers = {
  doctors: ['Doctor', 'Email address', 'Phone number', 'Account status'],
  medicines: ['Medicine', 'Category', 'Price', 'Stock', 'Prescription', 'Status'],
  appointments: ['Reference', 'Patient', 'Doctor', 'Date and time (Sri Lanka)', 'Appointment status', 'Payment method', 'Payment status'],
};
function cells(kind, item) {
  if (kind === 'doctors') return [text(item.fullName), text(item.email), text(item.mobileNumber), item.isActive ? 'Active' : 'Inactive'];
  if (kind === 'medicines') return [text(item.name), text(item.categoryName), Number.isFinite(item.price) ? money(item.price) : 'Unavailable',
    item.stockQuantity === 0 ? 'Out of stock' : Number.isFinite(item.stockQuantity) ? `${item.stockQuantity} units` : 'Unavailable',
    item.prescriptionRequired ? 'Required' : 'Not required', item.isActive ? 'Active' : 'Inactive'];
  return [text(item.reference), text(item.patientName), text(item.doctorName), dateTime(item.startUtc),
    statusLabel(item.status), methodLabel(item.paymentMethod), item.paymentStatus == null ? 'Payment status unavailable' : statusLabel(item.paymentStatus)];
}
export default function AdminDirectoryPage({ kind }) {
  const { user, role, token, isAuthenticated } = useAuth();
  const authorized = (user?.role ?? role) === 'Admin' && token && isAuthenticated !== false;
  const scope = authorized ? `${user?.userId ?? user?.id ?? ''}:${token}:${kind}` : '';
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ search: '', page: 1 });
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: '', loading: true, data: null, error: null });
  const key = `${scope}:${query.search}:${query.page}:${revision}`;
  useEffect(() => {
    let active = true;
    if (!scope) return;
    setState({ key, loading: true, data: null, error: null });
    loadAdminDirectory(kind, { ...query, pageSize: 20 }).then(data => {
      if (active) setState({ key, loading: false, data, error: null });
    }).catch(error => {
      if (active) setState({ key, loading: false, data: null, error: [401, 403].includes(error?.response?.status)
        ? 'Access denied. Please sign in with an authorized Admin account.' : `${labels[kind]} could not be loaded. Please retry.` });
    });
    return () => { active = false; };
  }, [key, scope, kind, query]);
  const current = state.key === key ? state : { loading: true, data: null, error: null };
  const { data, loading, error } = current;
  const refresh = () => setRevision(value => value + 1);
  return <DashboardLayout>
    <div className="welcome-banner"><h1>{labels[kind]}</h1><p>View {kind === 'doctors' ? 'registered doctor accounts, including inactive accounts' : kind === 'medicines'
      ? 'the medicine catalogue, stock and active status' : 'appointments across all doctors and patients'}. This page is read-only.</p></div>
    {!authorized ? <p role="alert" className="alert alert-error">Access denied. Admin access is required.</p> : <>
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <form onSubmit={event => { event.preventDefault(); setQuery({ search: search.trim(), page: 1 }); }} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}><label htmlFor="admin-directory-search">Search {kind}</label>
            <input id="admin-directory-search" type="search" className="form-input" maxLength={100} value={search} onChange={event => setSearch(event.target.value)}
              placeholder={kind === 'appointments' ? 'Appointment reference or doctor name' : kind === 'medicines' ? 'Medicine or category name' : 'Doctor name, email or phone'} /></div>
          <button type="submit" className="btn btn-primary"><Search size={16} />Search</button>
          <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading}><RefreshCw size={16} />Refresh</button>
        </form>
      </div>
      {loading && <p role="status">Loading {kind}…</p>}
      {error && <div role="alert" className="alert alert-error"><p>{error}</p><button type="button" className="btn btn-secondary" onClick={refresh}>Retry</button></div>}
      {data && <>
        {data.warning && <p role="status" className="management-alert error">{data.warning}</p>}
        <p>{data.totalCount} {kind} found</p>
        <div className="glass-card" style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr>{headers[kind].map(header => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{data.items.length ? data.items.map(item => <tr key={item.id}>{cells(kind, item).map((value, index) => <td key={headers[kind][index]}>{value}</td>)}</tr>)
            : <tr><td colSpan={headers[kind].length} className="empty-state">No {kind} found.</td></tr>}</tbody>
        </table></div>
        <nav aria-label={`${labels[kind]} pages`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
          <button type="button" className="btn btn-secondary" disabled={query.page <= 1} onClick={() => setQuery(value => ({ ...value, page: value.page - 1 }))}>Previous</button>
          <span>Page {query.page} of {Math.max(1, data.totalPages)}</span>
          <button type="button" className="btn btn-secondary" disabled={query.page >= data.totalPages} onClick={() => setQuery(value => ({ ...value, page: value.page + 1 }))}>Next</button>
        </nav>
      </>}
    </>}
  </DashboardLayout>;
}
