import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { staffOrderApi } from '../api/staffOrderApi';
import './PharmacyOrderManagementPage.css';

export default function PharmacyOrderManagementPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');

  const load = async () => {
    try {
      setError('');
      setOrders((await staffOrderApi.listActive()).data);
    } catch {
      setError('Unable to load medicine orders.');
    }
  };

  useEffect(() => { load(); }, []);

  const change = async (id, status, reason) => {
    try {
      await staffOrderApi.updateStatus(id, reason ? { status, reason } : { status });
      setRejectingId(null);
      setRejectionReason('');
      setRejectionError('');
      await load();
    } catch {
      setError('Unable to update this order. Please try again.');
    }
  };

  const startRejecting = (id) => {
    setRejectingId(id);
    setRejectionReason('');
    setRejectionError('');
  };

  const reject = (id) => {
    if (!rejectionReason.trim()) {
      setRejectionError('Provide a rejection reason.');
      return;
    }
    change(id, 'Rejected', rejectionReason.trim());
  };

  return (
    <DashboardLayout>
      <section className="orders-page staff-orders-page">
        <header className="staff-orders-header">
          <p className="staff-orders-eyebrow">Pharmacy workspace</p>
          <h1>Medicine orders</h1>
          <p className="order-intro">Prepare pending pharmacy pickup orders and record collection.</p>
        </header>
        {error && <div role="alert" className="order-error">{error}<button type="button" onClick={load}>Retry</button></div>}
        {!orders && !error && <p>Loading orders...</p>}
        {orders?.length === 0 && <p>No orders need pharmacy action.</p>}
        {orders?.map((order) => (
          <article className="order-card staff-order-card" key={order.id}>
            <div className="staff-order-details">
              <p className="staff-order-label">Order</p>
              <h2>{order.orderNumber}</h2>
              <p className="staff-order-items">{order.items.map((item) => `${item.medicineName} × ${item.quantity}`).join(', ')}</p>
              <p className="staff-order-total">LKR {Number(order.totalAmount).toFixed(2)}</p>
            </div>
            <div className="staff-order-actions">
              <span className="staff-order-status">{order.status}</span>
              {order.status === 'Pending' && (
                <>
                  <button className="staff-order-ready" type="button" onClick={() => change(order.id, 'ReadyForCollection')}>Mark ready for collection</button>
                  <button className="staff-order-reject" type="button" onClick={() => startRejecting(order.id)}>Reject order</button>
                  {rejectingId === order.id && (
                    <div className="order-rejection">
                      <label htmlFor={`rejection-reason-${order.id}`}>Rejection reason</label>
                      <input
                        id={`rejection-reason-${order.id}`}
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                      />
                      {rejectionError && <p role="alert">{rejectionError}</p>}
                      <div className="order-rejection-actions">
                        <button className="staff-order-confirm-rejection" type="button" onClick={() => reject(order.id)}>Confirm rejection</button>
                        <button className="staff-order-cancel" type="button" onClick={() => setRejectingId(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {order.status === 'ReadyForCollection' && <button className="staff-order-ready" type="button" onClick={() => change(order.id, 'Collected')}>Mark collected</button>}
            </div>
          </article>
        ))}
      </section>
    </DashboardLayout>
  );
}
