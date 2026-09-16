import React from 'react';
import './patientOrders.css';

export const money = (value) => `LKR ${Number(value || 0).toFixed(2)}`;
export const statusLabel = (status) => ({ Pending: 'Pending', ReadyForCollection: 'Ready for Collection', Collected: 'Collected', Rejected: 'Rejected' }[status] || status);
export const OrderStatus = ({ status }) => <span className={`order-status order-status-${status}`}>{statusLabel(status)}</span>;
export const OrderItems = ({ items = [], totalAmount, heading }) => <div className={`order-card ${heading ? 'order-items-card' : ''}`}>
  {heading && <div className="order-items-heading"><h2>{heading}</h2><span>{items.length} {items.length === 1 ? 'medicine' : 'medicines'}</span></div>}
  {items.map((item, index) => <article className="order-line" key={item.cartItemId || index}>
    <div><h3>{item.medicineName}</h3><p>Quantity: {item.quantity}</p><p>{money(item.unitPrice)} each</p></div>
    <strong>{money(item.lineTotal)}</strong>
  </article>)}
  <div className="order-total"><span>Total</span><strong>{money(totalAmount)}</strong></div>
</div>;
