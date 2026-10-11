import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardSectionState, money, dateTime, methodLabel, statusLabel } from './DashboardSectionState';
import '../../styles/role-dashboard.css';

function Queue({ title, queue, link, renderRow }) {
  return <div className="role-dashboard-queue"><div className="role-dashboard-heading"><h3>{title} ({queue.totalCount})</h3>{link && <Link to={link}>View all →</Link>}</div>
    {queue.items.length ? <><p>Showing {queue.items.length} of {queue.totalCount}</p><div className="management-list">{queue.items.map(item => <article className="list-row role-dashboard-row" key={item.id ?? item.medicineId}><div>{renderRow(item)}</div></article>)}</div></> : <p className="empty-state">Nothing awaiting attention.</p>}
  </div>;
}
function PaymentSection({ title, state, retry, medicine }) {
  const data = state?.data;
  return <DashboardSectionState title={title} state={state} retry={retry}>
    {data && <>
      <h3>Gross confirmed receipts</h3><p>Calendar periods in Sri Lanka time · LKR</p>
      {data.income.undatedSuccessfulCount > 0 && <div className="management-alert error" role="status">{data.income.undatedSuccessfulCount} successful payments have no confirmed date ({money(data.income.undatedSuccessfulAmount)}). Period totals include only known dated receipts.</div>}
      <dl className="role-dashboard-income"><div><dt>Today</dt><dd>{money(data.income.todayAmount)}</dd></div><div><dt>This month</dt><dd>{money(data.income.monthAmount)}</dd></div></dl>
      <p className="role-dashboard-refreshed">As of {new Date(data.income.asOfUtc).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })} (Sri Lanka)</p>
      <Queue title="Bank transfers awaiting verification" queue={data.pendingTransfers} link={medicine ? '/pharmacy/payments' : '/pharmacy/appointment-payments'}
        renderRow={p => <><strong>{p.reference}</strong><span>{money(p.amount)} · {statusLabel(p.status)}</span></>} />
      <h3>Recent confirmed payments</h3>{data.recentPayments.length ? <ul className="role-dashboard-payment-list">{data.recentPayments.map(p => <li key={p.id}>
        {medicine ? <Link to={`/pharmacy/payment-transactions/${p.id}`}>{p.reference}</Link> : <strong>{p.reference}</strong>} · {money(p.amount)} · {methodLabel(p.method)} · {dateTime(p.confirmedAtUtc)}
      </li>)}</ul> : <p className="empty-state">No dated confirmed payments available.</p>}
      {medicine && <Link to="/pharmacy/payment-transactions">View all medicine payments →</Link>}
    </>}
  </DashboardSectionState>;
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
    <PaymentSection title="Medicine payments and income" state={sections.medicinePayments} retry={() => refreshSection('medicinePayments')} medicine />
    <PaymentSection title="Appointment payments and income" state={sections.appointmentPayments} retry={() => refreshSection('appointmentPayments')} />
  </div>;
}
