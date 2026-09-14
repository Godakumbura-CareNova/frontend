import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { staffPrescriptionApi } from '../api/staffPrescriptionApi';
import './PharmacyPrescriptionReviewPage.css';

export default function PharmacyPrescriptionReviewPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    try {
      setError('');
      setItems((await staffPrescriptionApi.listPending()).data);
    } catch {
      setError('Unable to load prescriptions.');
    }
  };

  useEffect(() => { load(); }, []);

  const decide = async (id, decision, note) => {
    try {
      await staffPrescriptionApi.decide(id, { decision, reason: note });
      setRejecting(null);
      setReason('');
      await load();
    } catch {
      setError('Unable to update this prescription. Please try again.');
    }
  };

  const open = async (id) => {
    try {
      const file = await staffPrescriptionApi.download(id);
      const url = URL.createObjectURL(file.data);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Unable to open that prescription file.');
    }
  };

  const beginRejection = (id) => {
    setRejecting(id);
    setReason('');
  };

  return (
    <DashboardLayout>
      <section className="prescriptions-page staff-prescriptions-page">
        <header className="staff-prescriptions-header">
          <p className="staff-prescriptions-eyebrow">Pharmacy workspace</p>
          <h1>Prescription review</h1>
          <p>Verify prescriptions before patients can check out prescription medicines.</p>
        </header>

        {error && <div role="alert" className="management-alert error">{error}<button type="button" onClick={load}>Retry</button></div>}
        {!items && !error && <p>Loading prescriptions...</p>}
        {items?.length === 0 && <p>No prescriptions are waiting for verification.</p>}
        {items?.map((item) => (
          <article className="order-card staff-prescription-card" key={item.id}>
            <div className="staff-prescription-details">
              <p className="staff-prescription-label">Prescription awaiting review</p>
              <h2>{item.originalFileName}</h2>
              <p className="staff-prescription-medicine">{item.medicineName} × {item.quantity}</p>
              <button className="staff-prescription-file" type="button" onClick={() => open(item.id)}>Open file</button>
            </div>
            <div className="staff-prescription-actions">
              <span className="staff-prescription-status">Pending verification</span>
              <button className="staff-prescription-verify" type="button" onClick={() => decide(item.id, 'Verified')} aria-label="Verify prescription">Verify</button>
              <button className="staff-prescription-reject" type="button" onClick={() => beginRejection(item.id)}>Reject</button>
              {rejecting === item.id && (
                <div className="staff-prescription-rejection">
                  <label htmlFor={`prescription-reason-${item.id}`}>Rejection reason</label>
                  <input id={`prescription-reason-${item.id}`} value={reason} onChange={(event) => setReason(event.target.value)} />
                  <div className="staff-prescription-rejection-actions">
                    <button className="staff-prescription-confirm" type="button" disabled={!reason.trim()} onClick={() => decide(item.id, 'Rejected', reason.trim())}>Confirm rejection</button>
                    <button className="staff-prescription-cancel" type="button" onClick={() => setRejecting(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </DashboardLayout>
  );
}
