import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardSectionState, money, dateTime, statusLabel, methodLabel } from './DashboardSectionState';
import '../../styles/role-dashboard.css';

export default function PatientDashboardSections({ dashboard }) {
  const { sections, refreshSection } = dashboard;
  const orders = sections.orders?.data;
  const payments = sections.medicinePayments?.data;
  const appointments = sections.appointments?.data;
  return <div className="role-dashboard-grid">
    <DashboardSectionState title="Recent medicine orders" state={sections.orders} retry={() => refreshSection('orders')} link="/patient/orders" linkText="View all orders">
      {orders?.recentOrders.length ? <><p>Latest {orders.recentOrders.length} of {orders.totalCount} orders</p><div className="management-list">{orders.recentOrders.map(order => {
        const payment = payments?.recentPayments.find(p => p.orderId === order.id);
        return <article className="list-row role-dashboard-row" key={order.id}><div><Link to={`/patient/orders/${order.id}`}><strong>{order.reference}</strong></Link>
          <span>{dateTime(order.orderDate)} · {money(order.totalAmount)}</span><span>{statusLabel(order.status)}</span>
          <span>{payment ? `${methodLabel(payment.method)} · ${statusLabel(payment.status)}` : sections.medicinePayments?.error
            ? 'Payment information unavailable' : 'Open order details for payment information'}</span></div></article>;
      })}</div></> : <p className="empty-state">No medicine orders yet.</p>}
    </DashboardSectionState>
    <DashboardSectionState title="Upcoming appointments" state={sections.appointments} retry={() => refreshSection('appointments')} link={appointments ? '/patient/appointments' : null} linkText="View all appointments">
      {appointments?.appointments.length ? <><p>Next {appointments.appointments.length} of {appointments.upcomingCount} appointments</p><div className="management-list">{appointments.appointments.map(item => <article className="list-row role-dashboard-row" key={item.id}><div>
        <Link to={`/patient/appointments/${item.id}`}><strong>{item.reference}</strong></Link><span>{item.doctorName} · {dateTime(item.startUtc)}</span>
        <span>{statusLabel(item.status)} · {methodLabel(item.paymentMethod)} · {statusLabel(item.paymentStatus)}</span></div></article>)}</div></> : <p className="empty-state">No upcoming appointments.</p>}
    </DashboardSectionState>
    <DashboardSectionState title="Medicine payment statuses" state={sections.medicinePayments} retry={() => refreshSection('medicinePayments')}>
      {payments && <><div className="role-dashboard-statuses">{Object.entries(payments.statusCounts).map(([status, count]) => <span key={status}>{statusLabel(status)}: <strong>{count}</strong></span>)}</div>
        {payments.recentPayments.length ? <ul className="role-dashboard-payment-list">{payments.recentPayments.map(p => <li key={p.id}><strong>{p.reference}</strong> · {money(p.amount)} · {methodLabel(p.method)} · {statusLabel(p.status)}</li>)}</ul> : <p className="empty-state">No medicine payments yet.</p>}</>}
    </DashboardSectionState>
  </div>;
}
