import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CircleX, PackageCheck, RefreshCw, Wallet } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { orderApi } from '../api/orderApi';
import { getMedicinePayment } from '../services/paymentService';
import { PAYMENT_METHOD_LABELS } from '../utils/paymentValidation';
import { OrderItems, OrderStatus } from './orderPresentation';

const PAYMENT_STATUS_TEXT = {
  AwaitingOnlinePayment: 'Waiting for online payment',
  AwaitingBankTransfer: 'Waiting for your bank transfer',
  PayOnCollection: 'Pay at the counter when you collect',
};

const paymentSummary = (payment) => {
  if (payment === undefined) return <strong>Loading...</strong>;
  if (payment === 'error') return <strong>Unavailable right now</strong>;
  if (!payment) return <strong>Not chosen yet</strong>;
  const status = PAYMENT_STATUS_TEXT[payment.status];
  return <><strong>{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</strong>{status && <small>{status}</small>}</>;
};

export default function PatientOrderDetailsPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  // undefined while loading, null when no method has been chosen, 'error' when it could not be read.
  const [payment, setPayment] = useState(undefined);
  const load = async () => {
    setError('');
    setOrder(null);
    setPayment(undefined);
    try { setOrder((await orderApi.get(orderId)).data); }
    catch (failure) { setError(failure.response?.status === 404 ? 'Order not found.' : 'Unable to load this order.'); }
    try { setPayment((await getMedicinePayment(orderId)).data); }
    catch (failure) { setPayment(failure?.response?.status === 404 ? null : 'error'); }
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
        <div className="order-payment-method"><Wallet size={19} /><div><span>Payment method</span>{paymentSummary(payment)}</div></div>
        {order.rejectionReason && <div role="note" className="order-rejection-note"><CircleX size={21} /><div><strong>Order rejected</strong><p>{order.rejectionReason}</p></div></div>}
      </section>
      <OrderItems {...order} heading="Order items" />
    </>}
  </section></DashboardLayout>;
}
