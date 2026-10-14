import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layers, Clock3, CheckCircle2, XCircle, Ban, Search, RefreshCw, X, FileCheck } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import AppointmentReceiptVerificationPage from './AppointmentReceiptVerificationPage';
import { listAppointmentPaymentTransactions } from '../services/appointmentPaymentService';
import { TRANSACTION_CATEGORIES, describeTransactionError } from '../utils/paymentTransactions';
import { APPOINTMENT_PAYMENT_METHODS, appointmentPaymentLabel, appointmentDate } from '../utils/appointmentTransactions';
import { money } from '../components/dashboard/DashboardSectionState';
import './PaymentTransactionsPage.css';
import './AppointmentPaymentTransactionsPage.css';

const icons = { All: Layers, Pending: Clock3, Successful: CheckCircle2, Failed: XCircle, Rejected: Ban };
export default function AppointmentPaymentTransactionsPage() {
  const [params, setParams] = useSearchParams();
  const verification = params.get('view') === 'verification';
  const category = TRANSACTION_CATEGORIES.some(c => c.value === params.get('status')) ? params.get('status') : 'All';
  const method = Object.hasOwn(APPOINTMENT_PAYMENT_METHODS, params.get('method')) ? params.get('method') : '';
  const search = (params.get('search') || '').slice(0, 100);
  const rawPage = Number(params.get('page'));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 1000000 ? rawPage : 1;
  const [input, setInput] = useState(search);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const returnUrl = `/pharmacy/appointment-payments${params.toString() ? `?${params}` : ''}`;
  const update = values => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key));
    if (!Object.hasOwn(values, 'page')) next.delete('page');
    setParams(next);
  };
  useEffect(() => { setInput(search); }, [search]);
  useEffect(() => {
    if (verification) return;
    const controller = new AbortController();
    let active = true;
    setData(null); setError(null);
    listAppointmentPaymentTransactions({ status: category, method, search, page, pageSize: 20 }, controller.signal)
      .then(next => { if (active) setData(next); })
      .catch(failure => { if (active) setError(describeTransactionError(failure, 'We could not load appointment payments. Please try again.')); });
    return () => { active = false; controller.abort(); };
  }, [category, method, search, page, verification, attempt]);

  return <DashboardLayout><section className="transactions-page appointment-transactions">
    <header className="transactions-header transactions-list-header">
      <p className="transactions-eyebrow">Payment management</p>
      <h1>Appointment payment transactions</h1>
      <p>Review appointment payments across all methods and statuses.</p>
      <button type="button" className="transactions-btn" onClick={() => update({ view: verification ? '' : 'verification' })}>
        <FileCheck size={16} aria-hidden="true" />{verification ? 'Back to payment history' : 'Awaiting verification'}
      </button>
    </header>
    {verification ? <AppointmentReceiptVerificationPage /> : <>
      <div className="transactions-tiles" aria-label="Payment status filters">
        {TRANSACTION_CATEGORIES.map(item => { const Icon = icons[item.value]; return <button key={item.value} type="button" aria-pressed={category === item.value}
          className={`transactions-tile tile-${item.value.toLowerCase()}${category === item.value ? ' active' : ''}`} onClick={() => update({ status: item.value })}>
          <span className="tile-icon"><Icon size={18} aria-hidden="true" /></span><span className="tile-text"><span className="tile-label">{item.label}</span>
            <strong>{data?.counts?.[item.value.toLowerCase()] ?? '–'}</strong></span>
        </button>; })}
      </div>
      <div className="transactions-toolbar">
        <form noValidate className="transactions-search" role="search" onSubmit={event => { event.preventDefault(); update({ search: input.trim() }); }}>
          <Search size={16} aria-hidden="true" /><input aria-label="Search appointment payments" placeholder="Search appointment reference or doctor" maxLength={100} value={input} onChange={e => setInput(e.target.value)} />
          {input && <button type="button" className="transactions-btn" aria-label="Clear search" onClick={e => { setInput(''); update({ search: '' }); e.currentTarget.form.querySelector('input').focus(); }}><X size={16} aria-hidden="true" /></button>}
          <button className="transactions-btn" type="submit">Search</button>
        </form>
        {/* Native popup intentionally follows the platform, matching the medicine transactions page. */}
        <select aria-label="Payment method" value={method} onChange={e => update({ method: e.target.value })}><option value="">All methods</option>
          {Object.entries(APPOINTMENT_PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="transactions-btn" type="button" onClick={() => setAttempt(a => a + 1)}><RefreshCw size={14} aria-hidden="true" />Refresh</button>
      </div>
      <div className="apt-results" aria-busy={!data && !error}>
        {error && <div role="alert" className="transactions-alert">{error.message}{error.retryable && <button type="button" className="transactions-btn" onClick={() => setAttempt(a => a + 1)}>Retry</button>}</div>}
        {!data && !error && <p role="status" className="transactions-muted">Loading appointment payments…</p>}
        {data?.transactions.length === 0 && <p className="transactions-muted">No appointment payments match these filters.</p>}
        {!!data?.transactions.length && <>
          <p className="apt-scroll-hint">Scroll horizontally to view all payment details.</p>
          <div className="transactions-table-wrap" role="region" aria-label="Appointment payments table" tabIndex={0}><table className="transactions-table">
            <thead><tr><th scope="col">Appointment</th><th scope="col">Doctor</th><th scope="col">Method</th><th scope="col">Amount</th><th scope="col">Payment status</th><th scope="col">Appointment status</th><th scope="col">Last updated</th><th scope="col" aria-label="Actions" /></tr></thead>
            <tbody>{data.transactions.map(item => <tr key={item.id}>
              <td><strong>{item.reference}</strong><small>{appointmentDate(item.startUtc)}</small></td><td>{item.doctorName || 'Not recorded'}</td>
              <td>{APPOINTMENT_PAYMENT_METHODS[item.method] || 'Method unavailable'}</td><td>{money(item.amount)}</td>
              <td><span className={`transaction-status category-${item.category.toLowerCase()}`}>{appointmentPaymentLabel(item)}</span></td>
              <td>{item.appointmentStatus}</td><td>{appointmentDate(item.updatedAtUtc)}</td>
              <td><Link className="transactions-btn transactions-view" to={`/pharmacy/appointment-payments/transactions/${item.id}`} state={{ returnUrl }} aria-label={`View payment for ${item.reference}`}>View</Link></td>
            </tr>)}</tbody>
          </table></div>
        </>}
      </div>
      {data && <nav className="apt-pagination" aria-label="Payment history pages"><span role="status">{data.totalCount} payments · Page {data.page} of {Math.max(1, data.totalPages)}</span>
        <button type="button" className="transactions-btn" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })}>Previous</button>
        <button type="button" className="transactions-btn" disabled={data.page >= data.totalPages} onClick={() => update({ page: data.page + 1 })}>Next</button>
      </nav>}
    </>}
  </section></DashboardLayout>;
}
