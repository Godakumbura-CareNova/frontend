import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShoppingBag, Store } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { orderApi } from '../api/orderApi';
import { OrderItems, OrderStatus, money } from './orderPresentation';

export default function PatientCheckoutPage() {
  const { user } = useAuth();
  const owner = user?.userId || user?.id;
  const storageKey = owner ? `carenova-checkout:${owner}` : null;
  const [review, setReview] = useState(null);
  const [saved, setSaved] = useState(null);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const inFlight = useRef(false);

  const loadReview = async () => {
    setError(''); setReview(null);
    try { setReview((await orderApi.review()).data); }
    catch { setError('Unable to load checkout. Please try again.'); }
  };
  useEffect(() => {
    setReview(null); setSaved(null); setOrder(null); setError(''); setCanReview(false); setRecoveryBlocked(false);
    if (!storageKey) { setError('Please sign in again before placing an order.'); return; }
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const previous = JSON.parse(raw);
        if (!previous.request?.requestId || !Array.isArray(previous.review?.items)) throw new Error('Invalid checkout');
        setSaved(previous); setReview(previous.review);
        setError('Your previous order has not been confirmed here. Retry to check its result.');
      } else { loadReview(); }
    } catch { setRecoveryBlocked(true); setError('Unable to recover your checkout. Check My orders before trying again.'); }
  }, [storageKey]);

  const place = async () => {
    if (inFlight.current || recoveryBlocked || !storageKey || !review?.items.length) return;
    inFlight.current = true; setBusy(true); setError(''); setCanReview(false);
    let pending = saved;
    try {
      pending ||= { review, request: { requestId: crypto.randomUUID(), items: review.items.map(({ cartItemId, quantity, unitPrice }) => ({ cartItemId, quantity, unitPrice })) } };
      // Persist before sending: reloads and uncertain failures must reuse the exact request.
      sessionStorage.setItem(storageKey, JSON.stringify(pending));
      setSaved(pending);
    } catch {
      setError('Your browser could not save checkout progress. Enable session storage before placing an order.');
      inFlight.current = false; setBusy(false); return;
    }
    try {
      const result = (await orderApi.place(pending.request)).data;
      setOrder(result);
      try { sessionStorage.removeItem(storageKey); } catch { /* Retrying retained identity is safe. */ }
    } catch (failure) {
      const status = failure.response?.status;
      setCanReview(status === 400 || status === 404 || status === 409);
      setError(failure.response?.data?.message || 'We could not confirm your order. Retry order placement to safely check the result.');
    } finally { inFlight.current = false; setBusy(false); }
  };

  const refresh = async () => {
    try { sessionStorage.removeItem(storageKey); }
    catch { setError('Unable to reset checkout progress.'); return; }
    setSaved(null); setCanReview(false); await loadReview();
  };
  return <DashboardLayout><section className="orders-page checkout-page">
    {order ? <><h1>Order placed successfully</h1><div className="order-card order-summary"><h2>{order.orderNumber}</h2><OrderStatus status={order.status} /><p>Total: {money(order.totalAmount)}</p><p>Collection: Pharmacy pickup</p><Link className="order-primary" to={`/patient/orders/${order.id}`}>View my order</Link></div></> : <>
      <header className="checkout-hero">
        <span className="checkout-hero-icon"><ShoppingBag size={25} /></span>
        <div><p className="checkout-eyebrow">PHARMACY PICKUP</p><h1>Review your order</h1><p>Confirm your medicines for collection at the pharmacy.</p></div>
      </header>
      {error && <div role="alert" className="order-error">{error}</div>}
      {!review && !error && <p>Loading checkout...</p>}
      {recoveryBlocked && <Link to="/patient/orders">View My orders</Link>}
      {!review && error && !saved && storageKey && !recoveryBlocked && <button onClick={loadReview}>Retry loading checkout</button>}
      {review && (review.items.length ? <>
        <OrderItems {...review} heading="Order summary" />
        <div className="checkout-pickup-card">
          <span className="checkout-pickup-icon"><Store size={21} /></span>
          <div><h2>Pharmacy pickup</h2><p>Your order starts as <strong>Pending</strong>. We will notify you when it is ready for collection.</p></div>
          <CheckCircle2 className="checkout-pickup-check" size={23} aria-hidden="true" />
        </div>
        <div className="order-actions checkout-actions">
          <Link className="checkout-back" to="/patient/cart"><ArrowLeft size={17} />Back to cart</Link>
          <span className="checkout-action-group">{canReview && <button disabled={busy} onClick={refresh}>Refresh and review</button>}<button className="order-primary" disabled={busy} onClick={place}>{busy ? 'Placing order...' : saved ? 'Retry order placement' : 'Confirm and place order'}</button></span>
        </div>
      </> : <div className="order-card order-summary"><p>No medicines are ready to order yet.</p><Link to="/patient/cart">Back to cart</Link></div>)}
    </>}
  </section></DashboardLayout>;
}
