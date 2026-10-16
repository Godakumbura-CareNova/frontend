import React from 'react';
import { Link } from 'react-router-dom';
import { Pill, CalendarDays, Landmark, FileCheck2 } from 'lucide-react';
import { money, statusLabel, methodLabel } from './DashboardSectionState';
import '../../styles/role-dashboard.css';

const dateTime = value => new Date(value).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' });
function Section({ id, title, state, retry, children, fallbackAnchor }) {
  return <section id={id} aria-label={title} className="dashboard-section role-dashboard-section">
    <h2>{title}</h2>
    {(!state || state.loading) && <p role="status">{state?.data ? 'Refreshing information…' : 'Loading information…'}</p>}
    {state?.error && <div role="alert" className="management-alert error"><p>{state.error}</p>
      {state.stale && <p>Showing the last loaded information. It may be out of date.</p>}
      <button type="button" className="secondary-action" aria-label={`Retry ${title.toLowerCase()}`} onClick={retry}>Retry</button></div>}
    {state?.data && children}
    {!state?.data && fallbackAnchor && <div id={fallbackAnchor} />}
    {state?.lastRefreshed && <p className="role-dashboard-refreshed">Last refreshed: {dateTime(state.lastRefreshed)} (Sri Lanka)</p>}
  </section>;
}
function StatusCounts({ counts }) {
  return <div className="role-dashboard-statuses">{Object.entries(counts).map(([status, count]) => <span className={`ad-status ad-status-${['Paid', 'Successful', 'Completed', 'Collected', 'Confirmed', 'Booked'].includes(status) ? 'success' : ['Rejected', 'ReceiptRejected', 'Failed', 'Cancelled', 'NoShow'].includes(status) ? 'danger' : 'pending'}`} key={status}>{statusLabel(status)}: <strong>{count}</strong></span>)}</div>;
}
function PaymentSection({ title, state, retry, medicine }) {
  const data = state?.data;
  const Icon = medicine ? Pill : CalendarDays;
  return <Section title={title} state={state} retry={retry}>
    {data && <>
      <div className="ad-income-intro"><span className="ad-payment-icon"><Icon size={23} aria-hidden="true" /></span><div><h3>Gross confirmed receipts</h3><p>Calendar periods in Sri Lanka time · LKR. Gross receipts, before any refunds.</p></div></div>
      {data.income.undatedSuccessfulCount > 0 && <p role="status" className="management-alert error">{data.income.undatedSuccessfulCount} successful payments have no confirmed date ({money(data.income.undatedSuccessfulAmount)}). Period totals include only known dated receipts.</p>}
      <dl className="role-dashboard-income"><div><dt>Today</dt><dd>{money(data.income.todayAmount)}</dd></div><div><dt>This month</dt><dd>{money(data.income.monthAmount)}</dd></div></dl>
      <p className="role-dashboard-refreshed">As of {dateTime(data.income.asOfUtc)} (Sri Lanka)</p>
      <div className="ad-payment-summary"><h3>Payment summary</h3><p>{data.totalPayments} transactions</p><StatusCounts counts={data.statusCounts} /></div>
      <div className="ad-verification"><h3><Landmark size={18} aria-hidden="true" />Bank transfers awaiting verification</h3><p>{data.pendingTransfers.totalCount} uploaded receipts awaiting review</p>
      {data.pendingTransfers.items.length > 0 && <ul className="role-dashboard-payment-list">{data.pendingTransfers.items.map(p => <li key={p.id}>{p.reference} · {money(p.amount)} · {statusLabel(p.status)}</li>)}</ul>}
      </div>
      <h3 className="ad-recent-heading"><FileCheck2 size={18} aria-hidden="true" />Recent confirmed payments</h3>
      {data.recentPayments.length ? <div className="ad-table-scroll" tabIndex={0} role="region" aria-label={`${medicine ? 'Medicine' : 'Appointment'} confirmed payments`}><table className="ad-payments-table"><thead><tr><th scope="col">Reference</th><th scope="col">Amount</th><th scope="col">Method</th><th scope="col">Confirmed</th></tr></thead><tbody>{data.recentPayments.map(p => <tr key={p.id}>
        <td>{medicine ? <Link to={`/admin/payments/${p.id}`}>{p.reference}</Link> : <strong>{p.reference}</strong>}</td><td>{money(p.amount)}</td><td>{methodLabel(p.method)}</td><td>{dateTime(p.confirmedAtUtc)}</td>
      </tr>)}</tbody></table></div> : <p className="empty-state">No dated confirmed payments available.</p>}
      {medicine && <Link className="ad-all-payments" to="/admin/payments">View all medicine payments</Link>}
    </>}
  </Section>;
}
export default function AdminDashboardSections({ dashboard }) {
  const { sections, refreshSection } = dashboard;
  const operations = sections.operations?.data;
  const appointments = sections.appointments?.data;
  return <>
    <Section title="User statistics" state={sections.users} retry={() => refreshSection('users')}>
      <p>Registered account totals above include inactive accounts. Total users also includes administrators and other historical roles.</p>
      <Link to="/admin/users">Manage registered users</Link>
    </Section>
    <div className="role-dashboard-grid">
      <Section id="admin-orders" fallbackAnchor="admin-low-stock" title="Medicine order activity" state={sections.operations} retry={() => refreshSection('operations')}>
        {operations && <><StatusCounts counts={operations.orderStatusCounts} /><h3>Recent orders</h3>
          {operations.recentOrders.length ? <div className="management-list">{operations.recentOrders.map(o => <article className="list-row role-dashboard-row" key={o.id}><div>
            <strong>{o.reference}</strong><span>{dateTime(o.orderDate)} · {money(o.totalAmount)}</span><span>{statusLabel(o.status)}</span>
          </div></article>)}</div> : <p className="empty-state">No medicine orders yet.</p>}
          <section id="admin-low-stock" className="ad-low-stock" aria-label="Low-stock alerts"><h3>Low-stock alerts ({operations.lowStock.totalCount})</h3>
            {operations.lowStock.items.length ? <div className="management-list">{operations.lowStock.items.map(m => <article className="list-row role-dashboard-row" key={m.medicineId}><div>
              <strong>{m.medicineName}</strong><span>{m.quantity === 0 ? 'Out of stock' : `${m.quantity} units remaining`} · Alert threshold: {m.threshold}</span>
            </div></article>)}</div> : <p className="empty-state">No low-stock alerts.</p>}
          </section>
        </>}
      </Section>
      <Section id="admin-appointments" title="Appointment activity" state={sections.appointments} retry={() => refreshSection('appointments')}>
        {appointments && <><p>Today: {appointments.todayCount} · Upcoming active appointments: {appointments.upcomingCount}</p>
          <StatusCounts counts={appointments.statusCounts} /><h3>Recent appointments</h3>
          {appointments.recentAppointments.length ? <div className="management-list">{appointments.recentAppointments.map(a => <article className="list-row role-dashboard-row" key={a.id}><div>
            <strong>{a.reference}</strong><span>{a.doctorName || 'Doctor name unavailable'}</span><span>{dateTime(a.startUtc)} (Sri Lanka)</span>
            <span>{statusLabel(a.status)} · {methodLabel(a.paymentMethod)} · {statusLabel(a.paymentStatus)}</span>
          </div></article>)}</div> : <p className="empty-state">No appointments yet.</p>}
        </>}
      </Section>
    </div>
    <div id="admin-income"><h2 className="ad-section-title">Sales totals and payments</h2><div id="admin-payment-summary" className="role-dashboard-grid">
      <PaymentSection title="Medicine payments and income" state={sections.medicinePayments} retry={() => refreshSection('medicinePayments')} medicine />
      <PaymentSection title="Appointment payments and income" state={sections.appointmentPayments} retry={() => refreshSection('appointmentPayments')} />
    </div></div>
  </>;
}
