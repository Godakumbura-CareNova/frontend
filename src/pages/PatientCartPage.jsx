import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Pill, CheckCircle2, Clock3, AlertCircle, ArrowRight, ArrowLeft, Trash2, Store } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { cartApi } from '../api/cartApi';
import './patientCart.css';

const money = (amount) => `LKR ${Number(amount || 0).toFixed(2)}`;

export default function PatientCartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const load = async () => {
    setError('');
    try { setCart((await cartApi.get()).data); }
    catch { setError('Unable to load your cart.'); }
  };

  useEffect(() => { load(); }, []);

  const changeQuantity = async (item, quantity) => {
    setUpdatingId(item.id);
    try { setCart((await cartApi.updateItem(item.id, { quantity })).data); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update this cart item.'); }
    finally { setUpdatingId(null); }
  };

  const remove = async (id) => {
    setUpdatingId(id);
    try { setCart((await cartApi.removeItem(id)).data); }
    catch { setError('Unable to remove this cart item.'); }
    finally { setUpdatingId(null); }
  };

  const section = (title, items, subtotal, status) => {
    if (!items?.length) return null;
    const Icon = status === 'pending' ? Clock3 : status === 'attention' ? AlertCircle : CheckCircle2;
    return <section className={`cart-section cart-section-${status || 'ready'}`}>
      <div className="cart-section-heading"><div className="cart-section-title"><Icon size={20} aria-hidden="true" /><h2>{title}</h2></div><strong>{money(subtotal)}</strong></div>
      {items.map(item => <article className="cart-item" key={item.id}>
        <div className="cart-medicine"><span className="cart-medicine-icon"><Pill size={23} aria-hidden="true" /></span><div><h3>{item.medicineName}</h3><p className="cart-unit-price">{money(item.unitPrice)} each</p><p className="cart-item-quantity">Quantity: {item.quantity}</p>{status && <span className={`cart-status ${status}`}>{status === 'pending' ? 'Prescription pending verification' : 'Requires pharmacy attention'}</span>}</div></div>
        <div className="cart-item-actions">{!status && <div className="cart-quantity"><button disabled={updatingId === item.id || item.quantity === 1} onClick={() => changeQuantity(item, item.quantity - 1)} aria-label={`Decrease ${item.medicineName}`}>−</button><strong>{item.quantity}</strong><button disabled={updatingId === item.id} onClick={() => changeQuantity(item, item.quantity + 1)} aria-label={`Increase ${item.medicineName}`}>+</button></div>}<strong className="cart-line-price">{money(item.lineTotal)}</strong><button className="cart-remove" disabled={updatingId === item.id} onClick={() => remove(item.id)}><Trash2 size={15} aria-hidden="true" />Remove</button></div>
      </article>)}
    </section>;
  };
  const hasItems = cart && [cart.readyItems, cart.pendingItems, cart.attentionItems].some(items => items?.length);

  return <DashboardLayout><section className="cart-page">
    <header className="cart-header"><span className="cart-header-icon"><ShoppingCart size={28} aria-hidden="true" /></span><div><h1>My cart</h1><p>Order ready medicines for pharmacy pickup. Track prescription items while the pharmacy reviews them.</p></div></header>
    <Link className="cart-continue" to="/patient/medicines"><ArrowLeft size={16} aria-hidden="true" />Continue browsing medicines</Link>
    {error && <div role="alert" className="cart-error">{error}<button onClick={load}>Retry</button></div>}
    {!cart ? <p>Loading your cart...</p> : !hasItems ? <div className="cart-empty"><ShoppingCart size={36} aria-hidden="true" /><h2>Your cart is empty.</h2><p>Browse medicines to add your first item.</p></div> : <div className="cart-layout">
      <div className="cart-sections">{section('Ready to order', cart.readyItems, cart.readySubtotal, '')}{section('Waiting for pharmacy verification', cart.pendingItems, cart.pendingSubtotal, 'pending')}{section('Requires attention', cart.attentionItems, cart.attentionSubtotal, 'attention')}</div>
      <aside className="cart-summary" aria-labelledby="cart-summary-title"><h2 id="cart-summary-title">Cart summary</h2><p className="cart-pickup"><Store size={17} aria-hidden="true" />Pharmacy pickup</p>
        <div className="cart-summary-row cart-ready-subtotal"><span>Ready subtotal</span><strong>{money(cart.readySubtotal)}</strong></div>
        {!!cart.pendingItems?.length && <div className="cart-summary-row"><span>Awaiting verification</span><strong>{money(cart.pendingSubtotal)}</strong></div>}
        {!!cart.attentionItems?.length && <div className="cart-summary-row"><span>Requires attention</span><strong>{money(cart.attentionSubtotal)}</strong></div>}
        <div className="cart-total"><span>Cart total</span><strong>{money(cart.cartTotal)}</strong></div>
        <button className="cart-checkout" disabled={!cart.readyItems?.length || updatingId !== null} onClick={() => navigate('/patient/checkout')}>Checkout ready medicines<ArrowRight size={17} aria-hidden="true" /></button>
        <p className="cart-checkout-note">{cart.readyItems?.length ? 'Only ready medicines are included at checkout.' : 'Checkout becomes available when medicines are ready to order.'}</p>
      </aside>
    </div>}
  </section></DashboardLayout>;
}
