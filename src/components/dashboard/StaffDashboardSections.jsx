import React from 'react';
import { Link } from 'react-router-dom';
import { Pill, CalendarDays, Landmark, FileCheck2, CheckCircle2 } from 'lucide-react';
import { DashboardSectionState, money, dateTime, methodLabel, statusLabel } from './DashboardSectionState';
import '../../styles/role-dashboard.css';

function Queue({ title, queue, link, renderRow }) {
  return <div className="role-dashboard-queue"><div className="role-dashboard-heading"><h3>{title} ({queue.totalCount})</h3>{link && <Link to={link}>View all</Link>}</div>
    {queue.items.length ? <><p>Showing {queue.items.length} of {queue.totalCount}</p><div className="management-list">{queue.items.map(item => <article className="list-row role-dashboard-row" key={item.id ?? item.medicineId}><div>{renderRow(item)}</div></article>)}</div></> : <p className="empty-state">Nothing awaiting attention.</p>}
  </div>;
}
function IncomeCard({ title, state, retry, medicine }) {
  const data = state?.data;
  const Icon = medicine ? Pill : CalendarDays;
  return <div className="staff-income-card"><DashboardSectionState title={title} state={state} retry={retry}>
    {data && <>
      <div className="staff-income-description"><span className="staff-payment-icon"><Icon size={26} aria-hidden="true" /></span><p>Gross confirmed receipts · Sri Lanka time · LKR</p></div>
      <dl className="staff-income-totals"><div><dt>Today</dt><dd>{money(data.income.todayAmount)}</dd></div><div><dt>This month</dt><dd>{money(data.income.monthAmount)}</dd></div></dl>
      <p className="staff-payment-timestamp">As of {paymentTime(data.income.asOfUtc)} (Sri Lanka)</p>
    </>}
  </DashboardSectionState></div>;
}

const paymentTime = value => new Date(value).toLocaleString('en-LK', {
  timeZone: 'Asia/Colombo', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

function PaymentContent({ state, children }) {
  if (!state || state.loading) return <p className="staff-payment-empty" role="status">Loading payment information…</p>;
  if (state.error || !state.data) return <p className="staff-payment-empty">Payment information is unavailable. Use Retry on the income card above.</p>;
  return children(state.data);
}

function TransferQueue({ state, medicine }) {
  const link = medicine ? '/pharmacy/payments' : '/pharmacy/appointment-payments?view=verification';
  return <div className="staff-payment-column">
    <div className="staff-payment-subheading"><h3>{medicine ? 'Medicine orders' : 'Appointments'}{!state?.loading && !state?.error && state?.data ? ` (${state.data.pendingTransfers.totalCount})` : ''}</h3><Link to={link}>View all</Link></div>
    <PaymentContent state={state}>{data => data.pendingTransfers.items.length ? <>
      <p className="staff-payment-count">Showing {data.pendingTransfers.items.length} of {data.pendingTransfers.totalCount}</p>
      <ul className="staff-transfer-list">{data.pendingTransfers.items.map(p => <li key={p.id}>
        <strong>{p.reference}</strong><span>{money(p.amount)}</span><span className="staff-payment-badge">{statusLabel(p.status)}</span>
      </li>)}</ul>
    </> : <p className="staff-transfer-empty"><CheckCircle2 size={24} aria-hidden="true" />No receipts awaiting verification.</p>}</PaymentContent>
  </div>;
}

function RecentPayments({ state, medicine }) {
  return <div className="staff-payment-column">
    <div className="staff-payment-subheading"><h3>{medicine ? 'Medicines' : 'Appointments'}</h3>{medicine && <Link to="/pharmacy/payment-transactions">View all medicine payments</Link>}</div>
    <PaymentContent state={state}>{data => data.recentPayments.length ? <div className="staff-payment-table-scroll" tabIndex={0} role="region" aria-label={`Recent ${medicine ? 'medicine' : 'appointment'} confirmed payments`}>
      <table className="staff-payment-table"><thead><tr><th scope="col">Reference</th><th scope="col">Amount</th><th scope="col">Method</th><th scope="col">Confirmed</th></tr></thead>
        <tbody>{data.recentPayments.map(p => <tr key={p.id}>
          <td>{medicine ? <Link to={`/pharmacy/payment-transactions/${p.id}`}>{p.reference}</Link> : <strong>{p.reference}</strong>}</td>
          <td>{money(p.amount)}</td><td>{methodLabel(p.method)}</td><td>{paymentTime(p.confirmedAtUtc)}</td>
        </tr>)}</tbody>
      </table>
    </div> : <div className="staff-payment-empty"><FileCheck2 size={42} aria-hidden="true" /><strong>No confirmed payments yet</strong><p>No dated confirmed payments available.</p></div>}</PaymentContent>
  </div>;
}

function StaffPayments({ sections, refreshSection }) {
  const medicine = sections.medicinePayments;
  const appointments = sections.appointmentPayments;
  const bothReady = [medicine, appointments].every(state => state?.data && !state.loading && !state.error);
  const pendingCount = bothReady ? medicine.data.pendingTransfers.totalCount + appointments.data.pendingTransfers.totalCount : null;
  return <div className="staff-payments">
    <header className="staff-payments-title"><h2>Payments &amp; income</h2><p>Gross confirmed receipts · Sri Lanka time · LKR</p></header>
    <div className="staff-payment-columns">
      <IncomeCard title="Medicine payments and income" state={medicine} retry={() => refreshSection('medicinePayments')} medicine />
      <IncomeCard title="Appointment payments and income" state={appointments} retry={() => refreshSection('appointmentPayments')} />
    </div>
    <section className="staff-payment-panel" aria-label="Bank transfers awaiting verification">
      <div className="staff-payment-panel-heading"><span className="staff-payment-icon"><Landmark size={26} aria-hidden="true" /></span><h2>Bank transfers awaiting verification</h2>{pendingCount !== null && <span className="staff-payment-badge">{pendingCount}</span>}</div>
      <div className="staff-payment-columns"><TransferQueue state={medicine} medicine /><TransferQueue state={appointments} /></div>
    </section>
    <section className="staff-payment-panel" aria-label="Recent confirmed payments">
      <div className="staff-payment-panel-heading"><span className="staff-payment-icon"><FileCheck2 size={26} aria-hidden="true" /></span><h2>Recent confirmed payments</h2></div>
      <div className="staff-payment-columns"><RecentPayments state={medicine} medicine /><RecentPayments state={appointments} /></div>
    </section>
  </div>;
}
export default function StaffDashboardSections({ dashboard }) {
  const { sections, refreshSection } = dashboard;
  const operations = sections.operations?.data;
  return <div className="role-dashboard-grid">
    <DashboardSectionState title="Pharmacy operations" state={sections.operations} retry={() => refreshSection('operations')}>
      {operations && <>
        <Queue title="New medicine orders" queue={operations.newOrders} link="/pharmacy/orders" renderRow={o => <><strong>{o.reference}</strong><span>{dateTime(o.orderDate)} · {money(o.totalAmount)}</span></>} />
        <Queue title="Pending prescriptions" queue={operations.pendingPrescriptions} link="/pharmacy/prescriptions" renderRow={p => <><strong>{p.medicineName}</strong><span>{p.quantity} units · {dateTime(p.uploadedAtUtc)}</span></>} />
        <Queue title="Low-stock medicines" queue={operations.lowStock} link="/pharmacy/inventory" renderRow={m => <><strong>{m.medicineName}</strong><span>{m.quantity === 0 ? 'Out of stock' : `${m.quantity} units remaining`} · Alert threshold: {m.threshold}</span></>} />
        <Queue title="Ready for collection" queue={operations.readyForCollection} link="/pharmacy/orders" renderRow={o => <><strong>{o.reference}</strong><span>{dateTime(o.orderDate)} · {money(o.totalAmount)}</span></>} />
      </>}
    </DashboardSectionState>
    <StaffPayments sections={sections} refreshSection={refreshSection} />
  </div>;
}
