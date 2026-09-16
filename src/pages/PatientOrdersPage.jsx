import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, ClipboardList, PackageCheck, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { orderApi } from '../api/orderApi';
import { money, OrderStatus } from './orderPresentation';

export default function PatientOrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const load = async () => {
    setError('');
    try { setOrders((await orderApi.list()).data); }
    catch { setError('Unable to load your orders.'); }
  };
  useEffect(() => { load(); }, []);

  return <DashboardLayout><section className="orders-page orders-list-page">
    <header className="orders-list-header"><span className="orders-list-icon"><ClipboardList size={28} aria-hidden="true" /></span><div><h1>My orders</h1><p>View your pharmacy pickup orders and follow their current status.</p></div><button className="orders-refresh" onClick={load}><RefreshCw size={16} aria-hidden="true" />Refresh orders</button></header>
    {error && <div role="alert" className="order-error">{error}<button onClick={load}>Retry</button></div>}
    {!orders && !error && <p className="order-loading">Loading orders...</p>}
    {orders?.length === 0 && <div className="orders-empty"><ClipboardList size={36} aria-hidden="true" /><h2>No orders yet</h2><p>Your pharmacy pickup orders will appear here after checkout.</p><Link to="/patient/medicines">Browse medicines</Link></div>}
    {!!orders?.length && <section className="orders-history" aria-labelledby="orders-history-title"><div className="orders-history-heading"><div><p>PHARMACY PICKUP</p><h2 id="orders-history-title">Order history</h2></div><span>{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span></div><div className="orders-list">
      {orders.map(order => <article className="order-list-card" key={order.id}><div className="order-list-card-icon"><PackageCheck size={21} aria-hidden="true" /></div><div className="order-list-main"><Link to={`/patient/orders/${order.id}`}>{order.orderNumber}</Link><span><CalendarDays size={14} aria-hidden="true" />{order.orderDate ? new Date(order.orderDate).toLocaleString() : 'Date unavailable'}</span><span>Pharmacy pickup</span></div><div className="order-list-total"><span>Total</span><strong>{money(order.totalAmount)}</strong></div><div className="order-list-status"><OrderStatus status={order.status} /><Link aria-label={`View details for ${order.orderNumber}`} to={`/patient/orders/${order.id}`}><ArrowRight size={18} aria-hidden="true" /></Link></div></article>)}
    </div></section>}
  </section></DashboardLayout>;
}
