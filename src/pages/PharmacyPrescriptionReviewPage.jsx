import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { staffPrescriptionApi } from '../api/staffPrescriptionApi';

export default function PharmacyPrescriptionReviewPage() {
  const [items, setItems] = useState(null); const [error, setError] = useState(''); const [rejecting, setRejecting] = useState(null); const [reason, setReason] = useState('');
  const load = async () => { try { setError(''); setItems((await staffPrescriptionApi.listPending()).data); } catch { setError('Unable to load prescriptions.'); } };
  useEffect(() => { load(); }, []);
  const decide = async (id, decision, note) => { try { await staffPrescriptionApi.decide(id, { decision, reason: note }); setRejecting(null); setReason(''); await load(); } catch { setError('Unable to update this prescription. Please try again.'); } };
  const open = async (id) => { try { const file = await staffPrescriptionApi.download(id); const url = URL.createObjectURL(file.data); window.open(url, '_blank', 'noopener'); window.setTimeout(() => URL.revokeObjectURL(url), 1000); } catch { setError('Unable to open that prescription file.'); } };
  return <DashboardLayout><section className="prescriptions-page"><div className="management-heading"><h1>Prescription review</h1><p>Verify prescriptions before patients can check out prescription medicines.</p></div>
    {error && <div role="alert" className="management-alert error">{error}<button onClick={load}>Retry</button></div>}{!items && !error && <p>Loading prescriptions...</p>}{items?.length === 0 && <p>No prescriptions are waiting for verification.</p>}
    {items?.map(item => <article className="order-card" key={item.id}><div><h2>{item.originalFileName}</h2><p>{item.medicineName} × {item.quantity}</p><button onClick={() => open(item.id)}>Open file</button></div><div><button onClick={() => decide(item.id, 'Verified')} aria-label="Verify prescription">Verify</button><button onClick={() => setRejecting(item.id)}>Reject</button>{rejecting === item.id && <div><label>Reason<input value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={!reason.trim()} onClick={() => decide(item.id, 'Rejected', reason)}>Confirm rejection</button></div>}</div></article>)}</section></DashboardLayout>;
}
