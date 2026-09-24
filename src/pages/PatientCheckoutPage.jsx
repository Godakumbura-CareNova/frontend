import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, RefreshCw, ShoppingBag, Store } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import { CONFIRM_PAYMENT_DETAILS, PaymentMethodOptions, PaymentResult } from '../components/payments/MedicinePaymentMethodSelector';
import { useAuth } from '../context/AuthContext';
import { orderApi } from '../api/orderApi';
import { getMedicinePaymentMethods, selectMedicinePaymentMethod } from '../services/paymentService';
import { describePaymentError, validatePaymentSelection } from '../utils/paymentValidation';
import { OrderItems, OrderStatus, money } from './orderPresentation';
import '../components/payments/paymentMethods.css';

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
  const [methods, setMethods] = useState(null);
  const [methodsError, setMethodsError] = useState(null);
  const [method, setMethod] = useState('');
  const [methodError, setMethodError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [payment, setPayment] = useState(null);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const inFlight = useRef(false);

  const loadReview = async () => {
    setError(''); setReview(null);
    try { setReview((await orderApi.review()).data); }
    catch { setError('Unable to load checkout. Please try again.'); }
  };
  const loadMethods = async (amount) => {
    setMethodsError(null); setMethods(null);
    try { setMethods((await getMedicinePaymentMethods(amount)).data); }
    catch (failure) { setMethodsError(describePaymentError(failure, 'We could not load the payment methods. Please try again.')); }
  };
  useEffect(() => {
    setReview(null); setSaved(null); setOrder(null); setError(''); setCanReview(false); setRecoveryBlocked(false);
    setMethod(''); setPayment(null); setPaymentError(null);
    if (!storageKey) { setError('Please sign in again before placing an order.'); return; }
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const previous = JSON.parse(raw);
        if (!previous.request?.requestId || !Array.isArray(previous.review?.items)) throw new Error('Invalid checkout');
        setSaved(previous); setReview(previous.review); setMethod(previous.method || '');
        setError('Your previous order has not been confirmed here. Retry to check its result.');
      } else { loadReview(); }
    } catch { setRecoveryBlocked(true); setError('Unable to recover your checkout. Check My orders before trying again.'); }
  }, [storageKey]);
  const total = review?.items?.length ? review.totalAmount : null;
  useEffect(() => { if (total != null) loadMethods(total); }, [total]);

  // The method is saved against the order as soon as the order exists; a failure here leaves the order placed.
  const savePayment = async (orderId, chosen) => {
    setPaymentBusy(true); setPaymentError(null);
    try { setPayment((await selectMedicinePaymentMethod(orderId, chosen)).data); }
    catch (failure) { setPaymentError(describePaymentError(failure, 'Your order was placed, but we could not save your payment method. Please try again.')); }
    finally { setPaymentBusy(false); }
  };

  const place = async () => {
    setConfirming(false);
    if (inFlight.current || recoveryBlocked || !storageKey || !review?.items.length) return;
    inFlight.current = true; setBusy(true); setError(''); setCanReview(false);
    let pending = saved;
    try {
      pending = pending
        ? { ...pending, method: pending.method || method }
        : { review, method, request: { requestId: crypto.randomUUID(), items: review.items.map(({ cartItemId, quantity, unitPrice }) => ({ cartItemId, quantity, unitPrice })) } };
      // Persist before sending: reloads and uncertain failures must reuse the exact request and method.
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
      inFlight.current = false; setBusy(false);
      await savePayment(result.id, pending.method);
    } catch (failure) {
      const status = failure.response?.status;
      setCanReview(status === 400 || status === 404 || status === 409);
      setError(failure.response?.data?.message || 'We could not confirm your order. Retry order placement to safely check the result.');
      inFlight.current = false; setBusy(false);
    }
  };

  const requestPlace = () => {
    const chosen = saved?.method || method;
    const problem = validatePaymentSelection(chosen, methods || []);
    setMethodError(problem);
    if (problem) return;
    // A retry reuses the method already confirmed for this request.
    if (saved?.method) place(); else setConfirming(true);
  };

  const refresh = async () => {
    try { sessionStorage.removeItem(storageKey); }
    catch { setError('Unable to reset checkout progress.'); return; }
    setSaved(null); setCanReview(false); await loadReview();
  };

  const chosenOption = methods?.find((item) => item.method === method);
  const orderPaymentPath = order ? `/patient/orders/${order.id}/payment` : '';

  return <DashboardLayout><section className="orders-page checkout-page">
    {order ? <><h1>Order placed successfully</h1><div className="order-card order-summary"><h2>{order.orderNumber}</h2><OrderStatus status={order.status} /><p>Total: {money(order.totalAmount)}</p><p>Collection: Pharmacy pickup</p><Link className="checkout-back" to={`/patient/orders/${order.id}`}>View my order</Link></div>
      <section className="pay-card" aria-labelledby="pay-heading">
        {paymentBusy && <p className="pay-muted">Saving your payment method...</p>}
        {payment && <PaymentResult payment={payment} orderId={order.id} />}
        {paymentError && <><h2 id="pay-heading">Payment method</h2>
          <div role="alert" className="order-error pay-error">{paymentError.message}
            {paymentError.retryable && <button type="button" onClick={() => savePayment(order.id, saved?.method || method)}><RefreshCw size={15} /> Retry</button>}
          </div>
          <div className="pay-actions"><Link className="pay-secondary" to={orderPaymentPath}>Choose another method</Link></div></>}
      </section></> : <>
      <header className="checkout-hero">
        <span className="checkout-hero-icon"><ShoppingBag size={25} /></span>
        <div><p className="checkout-eyebrow">PHARMACY PICKUP</p><h1>Review your order</h1><p>Confirm your medicines and choose how to pay for collection at the pharmacy.</p></div>
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
        <section className="pay-card" aria-labelledby="pay-heading">
          <div className="pay-card-heading"><div><h2 id="pay-heading">Payment method</h2><p>Choose how you want to pay.</p></div><strong>{money(review.totalAmount)}</strong></div>
          {methodsError && <div role="alert" className="order-error pay-error">{methodsError.message}
            {methodsError.retryable && <button type="button" onClick={() => loadMethods(review.totalAmount)}><RefreshCw size={15} /> Retry</button>}
          </div>}
          {!methods && !methodsError && <p className="pay-muted">Loading payment methods...</p>}
          {methods && <PaymentMethodOptions methods={methods} selected={saved?.method || method} disabled={busy || Boolean(saved?.method)}
            onChange={(value) => { setMethod(value); setMethodError(''); }} />}
          {methodError && <div role="alert" className="order-error pay-error">{methodError}</div>}
        </section>
        <div className="order-actions checkout-actions">
          <Link className="checkout-back" to="/patient/cart"><ArrowLeft size={17} />Back to cart</Link>
          <span className="checkout-action-group">{canReview && <button disabled={busy} onClick={refresh}>Refresh and review</button>}<button className="order-primary" disabled={busy || !methods} onClick={requestPlace}>{busy ? 'Placing order...' : saved ? 'Retry order placement' : 'Confirm and place order'}</button></span>
        </div>
        <ConfirmDialog
          open={confirming}
          title="Place your order?"
          message={chosenOption ? `Place order for ${money(review.totalAmount)} and pay by ${chosenOption.label.toLowerCase()}? ${CONFIRM_PAYMENT_DETAILS[chosenOption.method] || ''}` : ''}
          confirmLabel="Place order"
          busy={busy}
          onConfirm={place}
          onCancel={() => setConfirming(false)}
        />
      </> : <div className="order-card order-summary"><p>No medicines are ready to order yet.</p><Link to="/patient/cart">Back to cart</Link></div>)}
    </>}
  </section></DashboardLayout>;
}
