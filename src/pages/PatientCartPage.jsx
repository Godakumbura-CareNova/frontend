import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { cartApi } from '../api/cartApi';
import './patientCart.css';

const money = (amount) => `LKR ${Number(amount || 0).toFixed(2)}`;

export default function PatientCartPage() {
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

  const section = (title, items, subtotal, status) => !items?.length ? null : <section className="cart-section"><div className="cart-section-heading"><h2>{title}</h2><strong>{money(subtotal)}</strong></div>{items.map(item => <article className="cart-item" key={item.id}><div><h3>{item.medicineName}</h3><span>{money(item.unitPrice)} each</span>{status && <span className={`cart-status ${status}`}>{status === 'pending' ? 'Prescription pending verification' : 'Requires pharmacy attention'}</span>}</div><div className="cart-item-actions">{!status && <div className="cart-quantity"><button disabled={updatingId === item.id || item.quantity === 1} onClick={() => changeQuantity(item, item.quantity - 1)} aria-label={`Decrease ${item.medicineName}`}>−</button><strong>{item.quantity}</strong><button disabled={updatingId === item.id} onClick={() => changeQuantity(item, item.quantity + 1)} aria-label={`Increase ${item.medicineName}`}>+</button></div>}<strong>{money(item.lineTotal)}</strong><button className="cart-remove" disabled={updatingId === item.id} onClick={() => remove(item.id)}>Remove</button></div></article>)}</section>;

  return <DashboardLayout><section className="cart-page"><div className="management-heading"><h1>My cart</h1><p>Ready medicines can be checked out in a future story. Prescription medicines remain here while the pharmacy reviews them.</p></div>{error && <div className="management-alert error">{error}<button onClick={load}>Retry</button></div>}{!cart ? <p>Loading your cart...</p> : <>{section('Ready to order', cart.readyItems, cart.readySubtotal, '')}{section('Waiting for pharmacy verification', cart.pendingItems, cart.pendingSubtotal, 'pending')}{section('Requires attention', cart.attentionItems, cart.attentionSubtotal, 'attention')}{!cart.cartTotal ? <div className="cart-empty">Your cart is empty.</div> : <div className="cart-total"><span>Cart total</span><strong>{money(cart.cartTotal)}</strong></div>}</>}</section></DashboardLayout>;
}
