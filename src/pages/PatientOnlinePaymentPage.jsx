import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, ShieldCheck } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { getMedicinePayment } from '../services/paymentService';
import { describePaymentError } from '../utils/paymentValidation';
import { money } from './orderPresentation';
import '../components/payments/paymentMethods.css';

// Where the online payment method leads. The card gateway itself is connected in a later story.
export default function PatientOnlinePaymentPage() {
  const { orderId } = useParams();
  const choosePath = `/patient/orders/${encodeURIComponent(orderId)}/payment`;
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null); setPayment(null);
    try { setPayment((await getMedicinePayment(orderId)).data); }
    catch (failure) {
      setError(failure?.response?.status === 404
        ? { message: 'Choose a payment method for this order first.', retryable: false }
        : describePaymentError(failure, 'We could not load your payment. Please try again.'));
    }
  };
  useEffect(() => { load(); }, [orderId]);

  return <DashboardLayout><section className="orders-page checkout-page">
    <Link className="order-back-link" to={choosePath}><ArrowLeft size={17} /> Payment method</Link>
    <header className="checkout-hero">
      <span className="checkout-hero-icon"><CreditCard size={25} /></span>
      <div><p className="checkout-eyebrow">ONLINE PAYMENT</p><h1>Pay online</h1><p>Pay for your medicine order by card.</p></div>
    </header>
    {error && <div role="alert" className="order-error pay-error">
      {error.message}
      {error.retryable ? <button type="button" onClick={load}>Retry</button> : <Link to={choosePath}>Choose a payment method</Link>}
    </div>}
    {!payment && !error && <p className="order-loading">Loading payment...</p>}
    {payment && (payment.method !== 'Online'
      ? <div className="pay-card"><p className="pay-muted">This order is set to be paid by {payment.method === 'BankTransfer' ? 'bank transfer' : 'cash'}, not online.</p>
          <div className="pay-actions"><Link className="order-primary" to={choosePath}>Change payment method</Link></div></div>
      : <div className="pay-card pay-online">
          <p className="pay-muted">Order {payment.orderNumber}</p>
          <p className="pay-online-amount">{money(payment.amount)}</p>
          <div className="pay-confirmed" role="status">
            <ShieldCheck size={22} aria-hidden="true" />
            <div><strong>Waiting for online payment</strong><p>Secure card payment is being connected. Your order is saved and will wait for your payment; you can also switch to bank transfer or cash.</p></div>
          </div>
          <div className="pay-actions">
            <Link className="pay-secondary" to={choosePath}>Change payment method</Link>
            <Link className="order-primary" to={`/patient/orders/${encodeURIComponent(orderId)}`}>View my order</Link>
          </div>
        </div>)}
  </section></DashboardLayout>;
}
