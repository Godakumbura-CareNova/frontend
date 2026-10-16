import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Calendar } from 'lucide-react';
import { DashboardSectionState, money, dateTime, statusLabel, methodLabel } from './DashboardSectionState';
import '../../styles/role-dashboard.css';

const statusTone = status => ['Paid', 'Successful', 'Collected', 'Completed', 'Confirmed', 'Booked'].includes(status)
  ? 'success' : ['Failed', 'Rejected', 'ReceiptRejected', 'Cancelled', 'NoShow'].includes(status)
    ? 'danger' : status == null ? 'neutral' : 'warning';

function StatusBadge({ status }) {
  return <span className={`pd-status pd-status-${statusTone(status)}`}>{statusLabel(status)}</span>;
}

function StatusCounts({ counts }) {
  return <dl className="pd-status-counts">{Object.entries(counts).map(([status, count]) =>
    <div key={status}><dt>{statusLabel(status)}</dt><dd className={`pd-status pd-status-${statusTone(status)}`}>{count}</dd></div>
  )}</dl>;
}

export default function PatientDashboardSections({ dashboard }) {
  const { sections, refreshSection } = dashboard;
  const orders = sections.orders?.data;
  const payments = sections.medicinePayments?.data;
  const appointments = sections.appointments?.data;

  return <>
    <div className="pd-activity-grid">
      <DashboardSectionState title="Recent medicine orders" state={sections.orders} retry={() => refreshSection('orders')} link="/patient/orders" linkText="View all orders" showArrow={false}>
        {orders?.recentOrders.length ? <>
          <div className="pd-table-scroll" role="region" aria-label="Recent medicine orders table" tabIndex={0}>
            <table className="pd-orders-table">
              <thead><tr><th scope="col">Order ID</th><th scope="col">Date & time</th><th scope="col">Amount</th><th scope="col">Order status</th><th scope="col">Payment status</th></tr></thead>
              <tbody>{orders.recentOrders.map(order => {
                const payment = payments?.recentPayments.find(p => p.orderId === order.id);
                return <tr key={order.id}>
                  <th scope="row"><Link to={`/patient/orders/${order.id}`}>{order.reference}</Link></th>
                  <td><time dateTime={order.orderDate}>{dateTime(order.orderDate)}</time></td>
                  <td className="pd-amount">{money(order.totalAmount)}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td>{payment ? <><StatusBadge status={payment.status} /><small className="pd-payment-method">{methodLabel(payment.method)}</small></> : <span className="pd-payment-unavailable">{sections.medicinePayments?.error ? 'Payment information unavailable' : 'Open order details for payment information'}</span>}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <p className="pd-list-caption">Latest {orders.recentOrders.length} of {orders.totalCount} orders</p>
        </> : <p className="empty-state">No medicine orders yet.</p>}
      </DashboardSectionState>

      <DashboardSectionState title="Upcoming appointments" state={sections.appointments} retry={() => refreshSection('appointments')} link={appointments ? '/patient/appointments' : null} linkText="View all appointments" showArrow={false}>
        {appointments?.appointments.length ? <>
          <div className="pd-appointment-list">{appointments.appointments.map(item => <article className="pd-appointment" key={item.id}>
            <div className="pd-date-tile" aria-hidden="true"><strong>{new Date(item.startUtc).getDate()}</strong><span>{new Date(item.startUtc).toLocaleDateString(undefined, { month: 'short' })}</span></div>
            <div className="pd-appointment-copy">
              <time dateTime={item.startUtc}>{dateTime(item.startUtc)}</time>
              <Link to={`/patient/appointments/${item.id}`}><strong>{item.reference}</strong></Link>
              <span>{item.doctorName}</span>
              <div className="pd-appointment-status"><StatusBadge status={item.status} /><StatusBadge status={item.paymentStatus} /></div>
              <small>{methodLabel(item.paymentMethod)}</small>
            </div>
          </article>)}</div>
          <p className="pd-list-caption">Next {appointments.appointments.length} of {appointments.upcomingCount} appointments</p>
        </> : <p className="empty-state">No upcoming appointments.</p>}
      </DashboardSectionState>
    </div>

    <section className="pd-payment-overview" aria-label="Payment overview">
      <h2>Payment overview</h2>
      <div className="pd-payment-grid">
        <div className="pd-payment-panel">
          <ShoppingBag className="pd-payment-icon" size={20} aria-hidden="true" />
          <DashboardSectionState id="patient-payment-statuses" title="Medicine payment statuses" state={sections.medicinePayments} retry={() => refreshSection('medicinePayments')}>
            {payments && <>
              <StatusCounts counts={payments.statusCounts} />
              {payments.recentPayments.length ? <ul className="pd-payment-list">{payments.recentPayments.map(p => <li key={p.id}><strong>{p.reference}</strong><span>{money(p.amount)} · {methodLabel(p.method)}</span><StatusBadge status={p.status} /></li>)}</ul> : <p className="empty-state">No medicine payments yet.</p>}
            </>}
          </DashboardSectionState>
        </div>
        <div className="pd-payment-panel">
          <Calendar className="pd-payment-icon" size={20} aria-hidden="true" />
          <DashboardSectionState title="Appointment payment statuses" state={sections.appointments} retry={() => refreshSection('appointments')}>
            {appointments && <StatusCounts counts={appointments.paymentStatusCounts} />}
          </DashboardSectionState>
        </div>
      </div>
    </section>
  </>;
}
