import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { staffOrderApi } from '../api/staffOrderApi';

export default function PharmacyOrderManagementPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const load = async () => { try { setError(''); setOrders((await staffOrderApi.listActive()).data); } catch { setError('Unable to load medicine orders.'); } };
  useEffect(() => { load(); }, []);
  const change = async (id, status) => { try { await staffOrderApi.updateStatus(id, { status }); await load(); } catch { setError('Unable to update this order. Please try again.'); } };
  return <DashboardLayout><section className="orders-page"><h1>Medicine orders</h1><p className="order-intro">Prepare pending pharmacy pickup orders and record collection.</p>
    {error && <div role="alert" className="order-error">{error}<button onClick={load}>Retry</button></div>}
    {!orders && !error && <p>Loading orders...</p>}
    {orders?.length === 0 && <p>No orders need pharmacy action.</p>}
    {orders?.map(order => <article className="order-card" key={order.id}><div><h2>{order.orderNumber}</h2><p>{order.items.map(item => `${item.medicineName} × ${item.quantity}`).join(', ')}</p><strong>LKR {Number(order.totalAmount).toFixed(2)}</strong></div><div><span className="prescription-status-badge">{order.status}</span>{order.status === 'Pending' && <button onClick={() => change(order.id, 'ReadyForCollection')}>Mark ready for collection</button>}{order.status === 'ReadyForCollection' && <button onClick={() => change(order.id, 'Collected')}>Mark collected</button>}</div></article>)}</section></DashboardLayout>;
}
