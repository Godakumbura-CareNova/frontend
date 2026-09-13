import React, { useEffect, useState } from 'react';
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
  return <DashboardLayout><section className="orders-page"><h1>My orders</h1><p className="order-intro">View your pharmacy pickup orders and their current status.</p>
    <button onClick={load}>Refresh orders</button>
    {error && <div role="alert" className="order-error">{error}<button onClick={load}>Retry</button></div>}
    {!orders && !error && <p>Loading orders...</p>}
    {orders?.length === 0 && <p>You have not placed any orders yet. <Link to="/patient/medicines">Browse medicines</Link></p>}
    {orders?.map(order => <article className="order-card order-line" key={order.id}><div><h2><Link to={`/patient/orders/${order.id}`}>{order.orderNumber}</Link></h2>{order.orderDate && <p>{new Date(order.orderDate).toLocaleString()}</p>}<p>{money(order.totalAmount)}</p></div><OrderStatus status={order.status} /></article>)}
  </section></DashboardLayout>;
}
