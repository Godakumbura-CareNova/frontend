import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CircleX, PackageCheck, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { orderApi } from '../api/orderApi';
import { OrderItems, OrderStatus } from './orderPresentation';

export default function PatientOrderDetailsPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const load = async () => {
    setError('');
    setOrder(null);
    try { setOrder((await orderApi.get(orderId)).data); }
    catch (failure) { setError(failure.response?.status === 404 ? 'Order not found.' : 'Unable to load this order.'); }
  };
  useEffect(() => { load(); }, [orderId]);
  return <DashboardLayout><section className="orders-page order-details-page">
    <Link className="order-back-link" to="/patient/orders"><ArrowLeft size={17} /> My orders</Link>
    {error && <div role="alert" className="order-error">{error}{error !== 'Order not found.' && <button onClick={load}>Retry</button>}</div>}
    {!order && !error && <p className="order-loading">Loading order...</p>}
    {order && <>
      <header className="order-details-header"><p>PHARMACY PICKUP ORDER</p><h1>Order {order.orderNumber}</h1></header>
      <section className="order-card order-details-summary">
        <div className="order-summary-top"><div><span className="order-summary-label">Current status</span><OrderStatus status={order.status} /></div><button className="order-refresh-button" onClick={load}><RefreshCw size={16} /> Refresh status</button></div>
        <div className="order-meta-grid"><div><PackageCheck size={19} /><div><span>Collection</span><strong>Pharmacy pickup</strong></div></div><div><CalendarDays size={19} /><div><span>Placed</span><strong>{order.orderDate ? new Date(order.orderDate).toLocaleString() : 'Date unavailable'}</strong></div></div></div>
        {order.rejectionReason && <div role="note" className="order-rejection-note"><CircleX size={21} /><div><strong>Order rejected</strong><p>{order.rejectionReason}</p></div></div>}
      </section>
      <OrderItems {...order} heading="Order items" />
    </>}
  </section></DashboardLayout>;
}
