import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { orderApi } from '../api/orderApi';
import { OrderItems, OrderStatus } from './orderPresentation';

export default function PatientOrderDetailsPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const load = async () => {
    setError(''); setOrder(null);
    try { setOrder((await orderApi.get(orderId)).data); }
    catch (failure) { setError(failure.response?.status === 404 ? 'Order not found.' : 'Unable to load this order.'); }
  };
  useEffect(() => { load(); }, [orderId]);
  return <DashboardLayout><section className="orders-page"><Link to="/patient/orders">Back to My orders</Link>
    {error && <div role="alert" className="order-error">{error}{error !== 'Order not found.' && <button onClick={load}>Retry</button>}</div>}
    {!order && !error && <p>Loading order...</p>}
    {order && <><h1>Order {order.orderNumber}</h1><div className="order-card order-summary"><OrderStatus status={order.status} /><p>Collection: Pharmacy pickup</p>{order.orderDate && <p>Placed: {new Date(order.orderDate).toLocaleString()}</p>}{order.rejectionReason && <div role="note"><strong>Rejection reason</strong><p>{order.rejectionReason}</p></div>}<button onClick={load}>Refresh status</button></div><OrderItems {...order} /></>}
  </section></DashboardLayout>;
}
